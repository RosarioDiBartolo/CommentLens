"""Persistent video snapshots; expensive network/ML work stays outside transactions."""
import hashlib
import json
import math
from datetime import timedelta

import numpy as np
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from pipeline.cleaner import CLEANING_VERSION, clean_comments
from pipeline.embedder import MODEL_VERSION, get_embeddings
from pipeline.clusterer import cluster_comments, label_clusters
from pipeline.main import get_comments
from pipeline.decision_analysis import analyze_decisions, summarize
from .models import Video, Comment, Embedding, Analysis, Cluster, ClusterMembership

MAX_COMMENTS = 50
PIPELINE_VERSION = '1'
RETENTION_DAYS = 29  # One-day margin for a daily purge schedule.


class InsufficientComments(ValueError):
    pass


def purge_expired():
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    return Video.objects.filter(fetched_at__lte=cutoff).delete()[0]


def signature():
    identity = [MODEL_VERSION, CLEANING_VERSION, PIPELINE_VERSION, MAX_COMMENTS]
    return hashlib.sha256(json.dumps(identity).encode()).hexdigest()


def text_hash(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def valid_vector(vector):
    return (isinstance(vector, list) and len(vector) == 384
            and all(isinstance(x, (int, float)) and not isinstance(x, bool)
                    and math.isfinite(x) for x in vector))


def serialize(analysis, cached):
    clusters = []
    for cluster in analysis.clusters.prefetch_related('memberships__embedding__comment'):
        members = []
        for member in cluster.memberships.all():
            comment = member.embedding.comment
            members.append({
                'comment_id': comment.pk, 'text': member.display_text,
                'author': comment.author, 'likes': comment.likes,
                'similarity': member.similarity,
            })
        members.sort(key=lambda c: (-c['similarity'], c['comment_id']))
        clusters.append({
            'cluster_id': cluster.rank, 'title': cluster.title, 'size': len(members),
            'percentage': cluster.percentage, 'avg_likes': cluster.avg_likes,
            'impact_score': cluster.impact_score,
            # Keep the previous API field for existing clients.
            'top_comments': [c['text'] for c in members[:3]],
            'comments': members,
        })
    return {
        'analysis_id': analysis.pk, 'video_id': analysis.video_id,
        'video_title': analysis.video.title,
        'total_comments_fetched': analysis.total_fetched,
        'total_after_cleaning': analysis.total_cleaned,
        'clusters': clusters, 'cached': cached,
        'fetched_at': analysis.video.fetched_at.isoformat(),
        'analyzed_at': analysis.completed_at.isoformat(),
    }


def analyze_video(video_id, refresh=False):
    previous = Analysis.objects.filter(video_id=video_id).values_list('decision_data', flat=True).first()
    result = analyze_semantics(video_id, refresh)
    # Capture comments from exactly the semantic snapshot returned above. Inference
    # runs outside the transaction; a concurrent replacement cannot receive our data.
    with transaction.atomic():
        current = Analysis.objects.select_related('video').filter(pk=result['analysis_id']).first()
        if current is None:
            result['decisions'] = {'status': 'unavailable', 'error': 'Comments changed during analysis. Retry.',
                                   'summary': summarize([]), 'comments': []}
            return result
        comments = list(current.video.comments.order_by('youtube_id').values('youtube_id', 'text'))
        raw = [{'comment_id': c['youtube_id'], 'text': c['text']} for c in comments]
        previous = current.decision_data or previous
    decisions = analyze_decisions(raw, result['video_title'], previous)
    Analysis.objects.filter(pk=result['analysis_id']).update(decision_data=decisions)
    result['decisions'] = decisions
    by_id = {row['comment_id']: row for row in decisions['comments']}
    for cluster in result['clusters']:
        rows = []
        for comment in cluster['comments']:
            row = by_id.get(comment['comment_id'])
            if row:
                comment['decisions'] = row['answers']
                rows.append(row)
        cluster['decision_summary'] = summarize(rows)
    return result


def analyze_semantics(video_id, refresh=False):
    purge_expired()
    now = timezone.now()
    ttl = timedelta(seconds=settings.ANALYSIS_CACHE_TTL_SECONDS)
    # A consistent read snapshot prevents concurrent refreshes mixing old/new rows.
    with transaction.atomic():
        current = Analysis.objects.select_related('video').filter(video_id=video_id).first()
        fresh = current and current.video.fetched_at > now - ttl
        if current and fresh and not refresh and current.signature == signature():
            return serialize(current, cached=True)
        # Changed pipeline settings can reuse a fresh comment snapshot.
        if fresh and not refresh:
            raw = [dict(comment_id=c.pk, text=c.text, author=c.author, likes=c.likes,
                        updated_at=c.updated_at, video_title=current.video.title)
                   for c in current.video.comments.order_by('youtube_id')]
            fetched_at = current.video.fetched_at
    if not fresh or refresh:
        raw = get_comments(video_id, max_comments=MAX_COMMENTS)
        fetched_at = timezone.now()
    cleaned = sorted(clean_comments(raw), key=lambda c: c['comment_id'])
    if len(raw) < 10 or len(cleaned) < 5:
        # A successful refresh must not keep serving a superseded snapshot.
        Video.objects.filter(pk=video_id, fetched_at__lte=fetched_at).delete()
        message = ('Not enough comments to analyze' if len(raw) < 10
                   else 'Not enough meaningful comments after cleaning')
        raise InsufficientComments(message)

    existing = {
        (e.comment_id, e.text_hash): e for e in Embedding.objects.filter(
            comment__video_id=video_id, model_version=MODEL_VERSION,
            cleaning_version=CLEANING_VERSION)
    }
    vectors = {}
    missing = []
    for comment in cleaned:
        key = (comment['comment_id'], text_hash(comment['search_text']))
        saved = existing.get(key)
        if saved and valid_vector(saved.vector):
            vectors[comment['comment_id']] = saved.vector
        else:
            missing.append(comment)
    if missing:
        generated = np.asarray(get_embeddings(missing))
        if generated.shape != (len(missing), 384) or not np.isfinite(generated).all():
            raise RuntimeError('Embedding model returned invalid vectors.')
        vectors.update({c['comment_id']: v.tolist() for c, v in zip(missing, generated)})
    matrix = np.array([vectors[c['comment_id']] for c in cleaned])
    labelled = label_clusters(cluster_comments(matrix, cleaned), len(cleaned))

    with transaction.atomic():
        newer = Analysis.objects.select_related('video').filter(
            video_id=video_id, video__fetched_at__gt=fetched_at, signature=signature()).first()
        if newer:
            return serialize(newer, cached=True)
        video, _ = Video.objects.update_or_create(pk=video_id, defaults={
            'title': raw[0]['video_title'], 'fetched_at': fetched_at})
        # Replace memberships before removing obsolete embeddings/comments.
        Analysis.objects.filter(video=video).delete()
        saved_comments = {}
        for c in raw:
            saved_comments[c['comment_id']], _ = Comment.objects.update_or_create(
                pk=c['comment_id'], defaults={
                    'video': video, 'text': c['text'], 'author': c['author'],
                    'likes': c['likes'], 'updated_at': c.get('updated_at', '')})
        video.comments.exclude(pk__in=saved_comments).delete()
        saved_embeddings = {}
        for c in cleaned:
            embedding, _ = Embedding.objects.update_or_create(
                comment=saved_comments[c['comment_id']],
                text_hash=text_hash(c['search_text']), model_version=MODEL_VERSION,
                cleaning_version=CLEANING_VERSION,
                defaults={'cleaned_text': c['search_text'], 'vector': vectors[c['comment_id']]})
            saved_embeddings[c['comment_id']] = embedding
        Embedding.objects.filter(comment__video=video).exclude(
            pk__in=[e.pk for e in saved_embeddings.values()]).delete()
        analysis = Analysis.objects.create(
            video=video, signature=signature(), completed_at=timezone.now(),
            total_fetched=len(raw), total_cleaned=len(cleaned))
        for result in labelled:
            cluster = Cluster.objects.create(
                analysis=analysis, rank=result['cluster_id'], title=result['title'],
                percentage=result['percentage'], avg_likes=result['avg_likes'],
                impact_score=result['impact_score'])
            ClusterMembership.objects.bulk_create([
                ClusterMembership(cluster=cluster, embedding=saved_embeddings[c['comment_id']],
                                  similarity=c['similarity'], display_text=c['text'])
                for c in result['comments']])
        # Read the response in the same transaction as the coherent snapshot.
        return serialize(analysis, cached=False)
