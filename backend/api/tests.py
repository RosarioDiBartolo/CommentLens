import copy
from datetime import timedelta
from unittest.mock import patch

import numpy as np
from django.core.management import call_command
from django.test import TestCase, SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Video, Comment, Embedding, Analysis, ClusterMembership
from api.services import analyze_video, InsufficientComments
from pipeline.main import extract_video_id, get_comments
from pipeline.clusterer import label_clusters, cluster_comments

VIDEO_ID = 'abcdefghijk'


def sample_comments():
    return [dict(comment_id=f'comment-{i:02}', text=f'This tutorial explains useful material number {i}',
                 author=f'Author {i}', likes=i * 3, updated_at='2026-01-01T00:00:00Z',
                 video_title='Example tutorial') for i in range(12)]


def embed(comments):
    vectors = np.zeros((len(comments), 384))
    for row, c in enumerate(comments):
        i = int(c['comment_id'].split('-')[1])
        vectors[row, 0] = 1
        vectors[row, 1] = i / 12
    return vectors


@override_settings(ANALYSIS_CACHE_TTL_SECONDS=86400, DECISION_PROVIDER='disabled')
class CacheTests(TestCase):
    def setUp(self):
        self.raw = sample_comments()
        self.fetch = patch('api.services.get_comments', side_effect=lambda *a, **k: copy.deepcopy(self.raw)).start()
        self.encode = patch('api.services.get_embeddings', side_effect=embed).start()
        self.cluster = patch('api.services.cluster_comments', side_effect=lambda vectors, comments: [
            {'comments': comments, 'embeddings': vectors}]).start()
        self.addCleanup(patch.stopall)

    def test_round_trip_reuses_complete_result_without_network_or_ml(self):
        first = analyze_video(VIDEO_ID)
        second = analyze_video(VIDEO_ID)
        self.assertFalse(first['cached'])
        self.assertTrue(second['cached'])
        self.assertEqual(first['clusters'], second['clusters'])
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 1)
        self.assertEqual(self.cluster.call_count, 1)
        self.assertEqual(Embedding.objects.count(), 12)
        for membership in ClusterMembership.objects.select_related('embedding__comment'):
            self.assertEqual(membership.display_text, membership.embedding.comment.text)
            i = int(membership.embedding.comment_id.split('-')[1])
            self.assertAlmostEqual(membership.embedding.vector[1], i / 12)
        self.assertNotIn('vector', second['clusters'][0]['comments'][0])

    def test_refresh_likes_reuses_vectors_and_updates_metadata(self):
        analyze_video(VIDEO_ID)
        self.raw[0]['likes'] = 999
        result = analyze_video(VIDEO_ID, refresh=True)
        self.assertEqual(self.fetch.call_count, 2)
        self.assertEqual(self.encode.call_count, 1)
        comments = result['clusters'][0]['comments']
        self.assertEqual(next(c['likes'] for c in comments if c['comment_id'] == 'comment-00'), 999)
        self.assertEqual(Analysis.objects.count(), 1)
        self.assertEqual(ClusterMembership.objects.count(), 12)

    def test_refresh_encodes_only_changed_and_new_comments_and_removes_missing(self):
        analyze_video(VIDEO_ID)
        self.raw[0]['text'] = 'An edited comment with entirely different words'
        self.raw[1]['comment_id'] = 'comment-99'
        analyze_video(VIDEO_ID, refresh=True)
        self.assertEqual({c['comment_id'] for c in self.encode.call_args.args[0]}, {'comment-00', 'comment-99'})
        self.assertFalse(Comment.objects.filter(pk='comment-01').exists())
        self.assertEqual(Embedding.objects.count(), 12)

    def test_model_and_cleaner_versions_invalidate_vectors_without_network(self):
        analyze_video(VIDEO_ID)
        with patch('api.services.MODEL_VERSION', 'another-model@revision'):
            analyze_video(VIDEO_ID)
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 2)
        with patch('api.services.CLEANING_VERSION', '2'):
            analyze_video(VIDEO_ID)
        self.assertEqual(self.encode.call_count, 3)
        self.assertEqual(Embedding.objects.count(), 12)

    def test_pipeline_version_reclusters_but_reuses_embeddings(self):
        analyze_video(VIDEO_ID)
        with patch('api.services.PIPELINE_VERSION', '2'):
            result = analyze_video(VIDEO_ID)
        self.assertFalse(result['cached'])
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.encode.call_count, 1)
        self.assertEqual(self.cluster.call_count, 2)

    def test_stale_analysis_fetches_again(self):
        analyze_video(VIDEO_ID)
        Video.objects.update(fetched_at=timezone.now() - timedelta(days=2))
        analyze_video(VIDEO_ID)
        self.assertEqual(self.fetch.call_count, 2)
        self.assertEqual(self.encode.call_count, 1)

    def test_failed_refresh_preserves_snapshot(self):
        first = analyze_video(VIDEO_ID)
        self.fetch.side_effect = RuntimeError('unavailable')
        with self.assertRaises(RuntimeError):
            analyze_video(VIDEO_ID, refresh=True)
        result = analyze_video(VIDEO_ID)
        self.assertEqual(first['analysis_id'], result['analysis_id'])

    def test_persistence_failure_rolls_back_entire_snapshot(self):
        first = analyze_video(VIDEO_ID)
        self.raw[0]['likes'] = 999
        with patch('api.services.ClusterMembership.objects.bulk_create', side_effect=RuntimeError('disk full')):
            with self.assertRaises(RuntimeError):
                analyze_video(VIDEO_ID, refresh=True)
        result = analyze_video(VIDEO_ID)
        self.assertEqual(first['analysis_id'], result['analysis_id'])
        self.assertEqual(first['clusters'], result['clusters'])

    def test_insufficient_refresh_removes_superseded_data(self):
        analyze_video(VIDEO_ID)
        self.raw = self.raw[:3]
        with self.assertRaises(InsufficientComments):
            analyze_video(VIDEO_ID, refresh=True)
        self.assertFalse(Video.objects.exists())
        self.assertFalse(Embedding.objects.exists())

    def test_cleanup_cascades_and_requests_purge_expired_data(self):
        analyze_video(VIDEO_ID)
        Video.objects.update(fetched_at=timezone.now() - timedelta(days=31))
        call_command('purge_video_cache', verbosity=0)
        self.assertFalse(Embedding.objects.exists())
        self.assertFalse(ClusterMembership.objects.exists())
        analyze_video(VIDEO_ID)
        Video.objects.update(fetched_at=timezone.now() - timedelta(days=31))
        analyze_video(VIDEO_ID)
        self.assertEqual(self.encode.call_count, 3)

    def test_corrupt_saved_vector_is_recomputed(self):
        analyze_video(VIDEO_ID)
        Embedding.objects.filter(comment_id='comment-00').update(vector=[1, 2])
        analyze_video(VIDEO_ID, refresh=True)
        self.assertEqual(len(self.encode.call_args.args[0]), 1)

    def test_invalid_model_output_never_replaces_snapshot(self):
        first = analyze_video(VIDEO_ID)
        self.raw[0]['text'] = 'This edited text needs a new embedding'
        self.encode.side_effect = lambda comments: np.full((len(comments), 384), np.nan)
        with self.assertRaisesRegex(RuntimeError, 'invalid vectors'):
            analyze_video(VIDEO_ID, refresh=True)
        self.assertEqual(Analysis.objects.get().pk, first['analysis_id'])

    def test_api_validation_and_canonical_video_cache(self):
        client = APIClient()
        for data in ({'url': 'not a video'}, {'url': VIDEO_ID, 'refresh': 'yes'}, {'url': 123}, []):
            self.assertEqual(client.post('/api/analyze/', data, format='json').status_code, 400)
        self.assertEqual(client.post('/api/analyze/', {'url': VIDEO_ID}, format='json').status_code, 200)
        response = client.post('/api/analyze/', {'url': f'https://youtu.be/{VIDEO_ID}?t=20'}, format='json')
        self.assertTrue(response.data['cached'])
        self.assertEqual(Video.objects.count(), 1)

    def test_no_clusters_is_a_valid_cached_result(self):
        self.cluster.side_effect = lambda *args: []
        first = analyze_video(VIDEO_ID)
        self.assertEqual(first['clusters'], [])
        self.assertTrue(analyze_video(VIDEO_ID)['cached'])


class PipelineTests(SimpleTestCase):
    def test_video_url_variants_and_rejection(self):
        for url in [VIDEO_ID, f'https://youtu.be/{VIDEO_ID}', f'https://www.youtube.com/watch?v={VIDEO_ID}&t=3',
                    f'youtube.com/shorts/{VIDEO_ID}', f'https://m.youtube.com/live/{VIDEO_ID}']:
            self.assertEqual(extract_video_id(url), VIDEO_ID)
        for url in ['https://evil.test/watch?v=' + VIDEO_ID, '', None, 'https://youtube.com/watch?v=short']:
            with self.assertRaises(ValueError):
                extract_video_id(url)

    def test_comment_ids_are_kept_during_ingestion(self):
        from unittest.mock import MagicMock
        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.return_value = {'items': []}
        youtube.commentThreads.return_value.list.return_value.execute.return_value = {'items': [{
            'snippet': {'topLevelComment': {'id': 'stable-id', 'snippet': {
                'textDisplay': 'Example useful comment text', 'likeCount': 7, 'authorDisplayName': 'Reader',
                'updatedAt': '2026-01-01T00:00:00Z'}}}}]}
        youtube.commentThreads.return_value.list_next.return_value = None
        with patch.dict('os.environ', {'YOUTUBE_API_KEY': 'test-placeholder'}), patch('pipeline.main.build', return_value=youtube):
            comments = get_comments(VIDEO_ID)
        self.assertEqual(comments[0]['comment_id'], 'stable-id')
        self.assertEqual(comments[0]['likes'], 7)

    def test_centroid_order_is_independent_of_likes_with_stable_ties(self):
        comments = [dict(comment_id='b', text='Left example', likes=100, author='B'),
                    dict(comment_id='a', text='Right example', likes=1, author='A'),
                    dict(comment_id='c', text='Centre example', likes=2, author='C')]
        labelled = label_clusters([{'comments': comments, 'embeddings': np.array([[1, 0], [0, 1], [1, 1]])}], 3)
        members = labelled[0]['comments']
        self.assertEqual([c['comment_id'] for c in members], ['c', 'a', 'b'])
        self.assertEqual([c['likes'] for c in members], [2, 1, 100])
        self.assertAlmostEqual(members[0]['similarity'], 1)

    def test_actual_clustering_accepts_small_samples(self):
        comments = [dict(comment_id=str(i)) for i in range(5)]
        vectors = np.random.default_rng(42).normal(size=(5, 384))
        clusters = cluster_comments(vectors, comments)
        self.assertIsInstance(clusters, list)
