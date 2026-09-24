import uuid
from django.db import models


class AnalysisRun(models.Model):
    """Immutable input snapshot shared by independent topic/opinion requests."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    video_id = models.CharField(max_length=11, db_index=True)
    video_title = models.TextField()
    fetched_at = models.DateTimeField(db_index=True)
    comments = models.JSONField()
    opinion_data = models.JSONField(default=dict, blank=True)

class Video(models.Model):
    youtube_id = models.CharField(max_length=11, primary_key=True)
    title = models.TextField()
    fetched_at = models.DateTimeField(db_index=True)


class Comment(models.Model):
    youtube_id = models.CharField(max_length=128, primary_key=True)
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    author = models.TextField()
    likes = models.PositiveIntegerField(default=0)
    updated_at = models.CharField(max_length=40, blank=True)


class Embedding(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='embeddings')
    text_hash = models.CharField(max_length=64)
    model_version = models.CharField(max_length=200)
    cleaning_version = models.CharField(max_length=40)
    cleaned_text = models.TextField()
    vector = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=['comment', 'text_hash', 'model_version', 'cleaning_version'],
            name='unique_comment_embedding',
        )]


class Analysis(models.Model):
    # Keep one coherent snapshot per video, replacing it atomically on refresh.
    video = models.OneToOneField(Video, on_delete=models.CASCADE, related_name='analysis')
    signature = models.CharField(max_length=64)
    completed_at = models.DateTimeField()
    total_fetched = models.PositiveIntegerField()
    total_cleaned = models.PositiveIntegerField()
    decision_data = models.JSONField(default=dict, blank=True)


class Cluster(models.Model):
    analysis = models.ForeignKey(Analysis, on_delete=models.CASCADE, related_name='clusters')
    rank = models.PositiveIntegerField()
    title = models.TextField()
    percentage = models.FloatField()
    avg_likes = models.FloatField()
    impact_score = models.FloatField()

    class Meta:
        ordering = ['rank']
        constraints = [models.UniqueConstraint(fields=['analysis', 'rank'], name='unique_cluster_rank')]


class ClusterMembership(models.Model):
    cluster = models.ForeignKey(Cluster, on_delete=models.CASCADE, related_name='memberships')
    embedding = models.ForeignKey(Embedding, on_delete=models.CASCADE)
    similarity = models.FloatField()
    display_text = models.TextField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['cluster', 'embedding'], name='unique_cluster_member')]
