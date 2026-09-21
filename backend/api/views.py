import json
import logging
from django.db import OperationalError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from googleapiclient.errors import HttpError

from pipeline.main import extract_video_id
from .models import Video
from .services import analyze_video, InsufficientComments

logger = logging.getLogger(__name__)


@api_view(['POST'])
def analyze(request):
    if not isinstance(request.data, dict):
        return Response({'error': 'Send a JSON object containing url.'}, status=400)
    try:
        video_id = extract_video_id(request.data.get('url'))
    except ValueError as error:
        return Response({'error': str(error)}, status=400)
    refresh = request.data.get('refresh', False)
    if not isinstance(refresh, bool):
        return Response({'error': 'refresh must be a boolean.'}, status=400)
    try:
        return Response(analyze_video(video_id, refresh=refresh))
    except InsufficientComments as error:
        return Response({'error': str(error)}, status=400)
    except HttpError as error:
        try:
            reason = json.loads(error.content)['error']['errors'][0]['reason']
        except (ValueError, KeyError, IndexError, TypeError):
            reason = ''
        if reason in ('commentsDisabled', 'videoNotFound'):
            Video.objects.filter(pk=video_id).delete()
            return Response({'error': 'Video unavailable or comments disabled.'}, status=400)
        if reason == 'quotaExceeded':
            return Response({'error': 'YouTube quota exceeded. Try again tomorrow.'}, status=503)
        return Response({'error': 'YouTube API error. Check backend credentials and restrictions.'}, status=502)
    except OperationalError:
        return Response({'error': 'Database unavailable or busy. Run migrations or retry shortly.'}, status=503)
    except Exception:
        # Do not return exception strings that could contain credentials or request URLs.
        logger.error('Video analysis failed for %s', video_id)
        return Response({'error': 'Analysis failed. Check backend configuration and model availability.'}, status=500)
