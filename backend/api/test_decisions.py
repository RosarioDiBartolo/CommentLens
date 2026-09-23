import copy
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, TestCase, override_settings

from api.models import Analysis, Video
from api.services import analyze_video
from api.tests import sample_comments, embed, VIDEO_ID
from inference.base import DecisionError
from inference.kev import KevDecisionModel, normalize_answers
from inference.mock import MockDecisionModel
from pipeline.decision_analysis import COMMENT_QUESTIONS, analyze_decisions


@override_settings(DECISION_PROVIDER='mock', KEV_ANALYSIS_BUDGET=120, KEV_TIMEOUT=30)
class DecisionTests(SimpleTestCase):
    def test_mock_returns_all_probabilities_and_score(self):
        result = analyze_decisions(sample_comments(), 'Title')
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['summary']['count'], 12)
        self.assertEqual(result['summary']['signals']['question']['yes'], 0.2)
        self.assertAlmostEqual(result['comments'][0]['answers']['toxicity']['score'], 0.12)

    def test_reuses_results_but_invalidates_text_title_and_model(self):
        raw = sample_comments()
        provider = Mock(wraps=MockDecisionModel())
        first = analyze_decisions(raw, 'Title', provider=provider)
        analyze_decisions(raw, 'Title', first, provider)
        self.assertEqual(provider.analyze.call_count, 12)
        raw[0]['text'] = 'Changed text'
        second = analyze_decisions(raw, 'Title', first, provider)
        self.assertEqual(provider.analyze.call_count, 13)
        analyze_decisions(raw, 'Changed title', second, provider)
        self.assertEqual(provider.analyze.call_count, 25)
        with override_settings(KEV_MODEL_VERSION='new'):
            analyze_decisions(raw, 'Title', second, provider)
        self.assertEqual(provider.analyze.call_count, 37)

    def test_partial_failure_and_retry_only_missing_comments(self):
        provider = Mock()
        answer = MockDecisionModel().analyze(None, COMMENT_QUESTIONS)
        provider.analyze.side_effect = [answer, DecisionError('Server unavailable')]
        first = analyze_decisions(sample_comments(), 'Title', provider=provider)
        self.assertEqual(first['status'], 'partial')
        self.assertEqual(first['summary']['count'], 1)
        self.assertEqual(provider.analyze.call_count, 2)
        provider.analyze.side_effect = None
        provider.analyze.return_value = answer
        result = analyze_decisions(sample_comments(), 'Title', first, provider)
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(provider.analyze.call_count, 13)

    def test_budget_stops_before_next_request(self):
        provider = Mock()
        with patch('pipeline.decision_analysis.time.monotonic', side_effect=[0, 121]):
            result = analyze_decisions(sample_comments(), 'Title', provider=provider)
        self.assertEqual(result['status'], 'unavailable')
        provider.analyze.assert_not_called()

    @override_settings(DECISION_PROVIDER='disabled')
    def test_disabled_makes_no_requests(self):
        provider = Mock()
        self.assertEqual(analyze_decisions([], '', provider=provider)['status'], 'disabled')
        provider.analyze.assert_not_called()


class KevContractTests(SimpleTestCase):
    @patch('inference.kev.requests.post')
    def test_request_contract_auth_timeout_and_normalization(self, post):
        post.return_value.status_code = 200
        post.return_value.json.return_value = {'answers': {
            'sentiment': {'type': 'choice', 'choice': 'positive',
                          'probabilities': {'positive': .7, 'neutral': .2, 'negative': .1}},
            'question': {'type': 'noul', 'noul': .8},
            'toxicity': {'type': 'score', 'score': .4,
                         'probabilities': {'0': .7, '1': .2, '2': .1}},
        }}
        questions = {key: COMMENT_QUESTIONS[key] for key in ('sentiment', 'question', 'toxicity')}
        result = KevDecisionModel('https://example.test/', api_key='secret').analyze('text', questions, 12)
        self.assertEqual(result['question']['label'], 'yes')
        self.assertAlmostEqual(result['toxicity']['score'], .4)
        self.assertEqual(post.call_args.args[0], 'https://example.test/v1/systemone')
        self.assertEqual(post.call_args.kwargs['headers'], {'Authorization': 'Bearer secret'})
        self.assertEqual(post.call_args.kwargs['timeout'], 12)
        self.assertFalse(post.call_args.kwargs['allow_redirects'])
        self.assertEqual(post.call_args.kwargs['json']['questions'], questions)

    @patch('inference.kev.requests.post')
    def test_http_timeout_and_invalid_json_are_safe(self, post):
        client = KevDecisionModel('https://example.test')
        for status in (302, 401, 422, 500):
            post.return_value.status_code = status
            with self.assertRaises(DecisionError):
                client.analyze('text', COMMENT_QUESTIONS)
        post.side_effect = requests.Timeout('sensitive URL')
        with self.assertRaises(DecisionError) as context:
            client.analyze('text', COMMENT_QUESTIONS)
        self.assertNotIn('sensitive', str(context.exception))
        post.side_effect = None
        post.return_value.status_code = 200
        post.return_value.json.side_effect = ValueError('invalid json')
        with self.assertRaises(DecisionError):
            client.analyze('text', COMMENT_QUESTIONS)

    def test_malformed_answers_rejected(self):
        for value in (True, float('nan'), float('inf'), -1, 2, '0.5', None):
            with self.subTest(value=value), self.assertRaises(DecisionError):
                normalize_answers({'question': {'type': 'noul', 'noul': value}},
                                  {'question': COMMENT_QUESTIONS['question']})
        for probs in ({'positive': .3}, {'positive': .9, 'neutral': .9, 'negative': .9}):
            with self.assertRaises(DecisionError):
                normalize_answers({'sentiment': {'type': 'choice', 'probabilities': probs}},
                                  {'sentiment': COMMENT_QUESTIONS['sentiment']})
        with self.assertRaises(DecisionError):
            normalize_answers(None, COMMENT_QUESTIONS)


@override_settings(DECISION_PROVIDER='mock', ANALYSIS_CACHE_TTL_SECONDS=86400)
class DecisionIntegrationTests(TestCase):
    def setUp(self):
        self.raw = sample_comments()
        self.fetch = patch('api.services.get_comments', side_effect=lambda *a, **k: copy.deepcopy(self.raw)).start()
        self.encode = patch('api.services.get_embeddings', side_effect=embed).start()
        patch('api.services.cluster_comments', side_effect=lambda vectors, comments: [
            {'comments': comments, 'embeddings': vectors}]).start()
        self.addCleanup(patch.stopall)

    def test_persists_all_raw_comments_and_topic_cross_analysis(self):
        self.raw.append(dict(self.raw[0], comment_id='short', text='Great!'))
        first = analyze_video(VIDEO_ID)
        self.assertEqual(first['decisions']['summary']['count'], 13)
        self.assertEqual(first['clusters'][0]['decision_summary']['count'], 12)
        self.assertIn('decisions', first['clusters'][0]['comments'][0])
        with patch('inference.mock.MockDecisionModel.analyze') as infer:
            second = analyze_video(VIDEO_ID)
        infer.assert_not_called()
        self.assertTrue(second['cached'])
        self.assertEqual(Analysis.objects.get().decision_data['summary']['count'], 13)
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 1)
        Video.objects.all().delete()
        self.assertFalse(Analysis.objects.exists())

    def test_offline_then_retry_keeps_semantics_and_does_not_refetch(self):
        with patch('inference.mock.MockDecisionModel.analyze', side_effect=DecisionError('Offline')):
            first = analyze_video(VIDEO_ID)
        self.assertEqual(first['decisions']['status'], 'unavailable')
        self.assertTrue(first['clusters'])
        second = analyze_video(VIDEO_ID)
        self.assertEqual(second['decisions']['status'], 'complete')
        self.assertEqual(first['analysis_id'], second['analysis_id'])
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 1)

    def test_refresh_reuses_decisions_for_likes_but_not_changed_text(self):
        analyze_video(VIDEO_ID)
        self.raw[0]['likes'] = 999
        self.raw[1]['text'] = 'An edited comment with several new words'
        with patch('inference.mock.MockDecisionModel.analyze', wraps=MockDecisionModel().analyze) as infer:
            result = analyze_video(VIDEO_ID, refresh=True)
        self.assertEqual(infer.call_count, 1)
        self.assertEqual(result['decisions']['summary']['count'], 12)

    def test_provider_change_does_not_recompute_semantics(self):
        with override_settings(DECISION_PROVIDER='disabled'):
            first = analyze_video(VIDEO_ID)
        second = analyze_video(VIDEO_ID)
        self.assertEqual(first['analysis_id'], second['analysis_id'])
        self.assertEqual(second['decisions']['status'], 'complete')
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 1)
