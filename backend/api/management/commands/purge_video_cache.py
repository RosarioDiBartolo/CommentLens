from django.core.management.base import BaseCommand
from api.services import purge_expired


class Command(BaseCommand):
    help = 'Delete video snapshots and their comments/embeddings after 29 days (one-day margin for daily scheduling).'

    def handle(self, *args, **options):
        count = purge_expired()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} expired database records.'))
