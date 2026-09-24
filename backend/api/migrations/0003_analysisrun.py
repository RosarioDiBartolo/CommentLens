import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0002_analysis_decision_data')]
    operations = [migrations.CreateModel(
        name='AnalysisRun',
        fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('video_id', models.CharField(max_length=11, db_index=True)),
            ('video_title', models.TextField()),
            ('fetched_at', models.DateTimeField(db_index=True)),
            ('comments', models.JSONField()),
            ('opinion_data', models.JSONField(default=dict, blank=True)),
        ],
    )]
