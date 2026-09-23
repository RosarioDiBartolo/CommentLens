from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0001_initial')]
    operations = [migrations.AddField(
        model_name='analysis', name='decision_data',
        field=models.JSONField(default=dict, blank=True))]
