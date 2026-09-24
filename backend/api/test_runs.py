import copy
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import AnalysisRun
from api.services import prepare_analysis, analyze_topics, analyze_opinions, purge_expired
from api.tests import sample_comments, embed, VIDEO_ID
from inference.base import DecisionError


@override_settings(DECISION_PROVIDER='mock', ANALYSIS_CACHE_TTL_SECONDS=86400)
class IndependentAnalysisTests(TestCase):
    def setUp(self):
        self.raw = sample_comments()
        self.fetch = patch('api.services.get_comments', side_effect=lambda *a, **k: copy.deepcopy(self.raw)).start()
        self.encode = patch('api.services.get_embeddings', side_effect=embed).start()
        self.cluster = patch('api.services.cluster_comments', side_effect=lambda vectors, comments: [
            {'comments': comments, 'embeddings': vectors}]).start()
        self.addCleanup(patch.stopall)

    def test_preparation_fetches_once_without_running_either_analysis(self):
        with patch('api.services.analyze_decisions') as opinions:
            first = prepare_analysis(VIDEO_ID)
            second = prepare_analysis(VIDEO_ID)
        self.assertEqual(first['run_id'], second['run_id'])
        self.assertTrue(second['cached'])
        self.fetch.assert_called_once()
        self.encode.assert_not_called()
        opinions.assert_not_called()

    def test_opinions_finish_before_topics_and_survive_a_topic_failure(self):
        run_id = prepare_analysis(VIDEO_ID)['run_id']
        opinion = analyze_opinions(run_id)
        self.assertEqual(opinion['decisions']['status'], 'complete')
        self.assertEqual(opinion['decisions']['comments'][0]['author'], 'Author 0')
        self.encode.assert_not_called()
        with patch('api.services.get_embeddings', side_effect=RuntimeError('offline')):
            with self.assertRaises(RuntimeError):
                analyze_topics(run_id)
        self.assertEqual(analyze_opinions(run_id), opinion)
        self.assertTrue(analyze_topics(run_id)['clusters'])
        self.fetch.assert_called_once()

    def test_opinions_work_when_there_are_too_few_comments_for_topics(self):
        self.raw = self.raw[:3]
        run_id = prepare_analysis(VIDEO_ID)['run_id']
        client = APIClient()
        self.assertEqual(client.post(f'/api/runs/{run_id}/topics/', {}, format='json').status_code, 400)
        response = client.post(f'/api/runs/{run_id}/opinions/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['decisions']['summary']['count'], 3)

    def test_topic_completion_does_not_wait_for_opinions_and_retry_is_independent(self):
        run_id = prepare_analysis(VIDEO_ID)['run_id']
        with patch('api.services.analyze_decisions') as opinions:
            topics = analyze_topics(run_id)
        opinions.assert_not_called()
        with patch('inference.mock.MockDecisionModel.analyze', side_effect=DecisionError('offline')):
            self.assertEqual(analyze_opinions(run_id)['decisions']['status'], 'unavailable')
        self.assertEqual(analyze_opinions(run_id)['decisions']['status'], 'complete')
        self.assertEqual(analyze_topics(run_id)['analysis_id'], topics['analysis_id'])
        self.fetch.assert_called_once()
        self.encode.assert_called_once()

    def test_refresh_creates_immutable_snapshot_and_old_results_cannot_mix(self):
        first = prepare_analysis(VIDEO_ID)
        self.raw[0]['text'] = 'Different words in the next snapshot'
        second = prepare_analysis(VIDEO_ID, refresh=True)
        self.assertNotEqual(first['run_id'], second['run_id'])
        self.assertNotEqual(AnalysisRun.objects.get(pk=first['run_id']).comments[0]['text'], self.raw[0]['text'])
        analyze_topics(second['run_id'])
        response = APIClient().post(f"/api/runs/{first['run_id']}/topics/", {}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertNotEqual(analyze_opinions(first['run_id'])['decisions']['comments'][0]['text'], self.raw[0]['text'])

    def test_expiration_cleans_run_data_and_returns_recoverable_error(self):
        run_id = prepare_analysis(VIDEO_ID)['run_id']
        AnalysisRun.objects.update(fetched_at=timezone.now() - timedelta(days=30))
        self.assertEqual(APIClient().post(f'/api/runs/{run_id}/opinions/', {}).status_code, 404)
        purge_expired()
        self.assertFalse(AnalysisRun.objects.exists())

    def test_prepare_endpoint_validates_input_and_refresh(self):
        client = APIClient()
        self.assertEqual(client.post('/api/runs/', {'url': 'invalid'}, format='json').status_code, 400)
        self.assertEqual(client.post('/api/runs/', {'url': VIDEO_ID, 'refresh': 'yes'}, format='json').status_code, 400)
        response = client.post('/api/runs/', {'url': VIDEO_ID}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('run_id', response.data)
