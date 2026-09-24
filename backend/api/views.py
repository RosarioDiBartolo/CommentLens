import json
import logging
from django.db import OperationalError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from googleapiclient.errors import HttpError

from pipeline.main import extract_video_id
from .models import Video, AnalysisRun
from .services import (analyze_video, InsufficientComments, SnapshotChanged,
                       prepare_analysis, analyze_topics, analyze_opinions)

logger = logging.getLogger(__name__)


def _analyze_request(request, operation):
    if not isinstance(request.data, dict):
        return Response({'error': 'Send a JSON object containing url.'}, status=400)
    try:
        video_id = extract_video_id(request.data.get('url'))
    except ValueError as error:
        return Response({'error': str(error)}, status=400)
    refresh = request.data.get('refresh', False)
    if not isinstance(refresh, bool):
        return Response({'error': 'refresh must be a boolean.'}, status=400)
    return _respond(lambda: operation(video_id, refresh=refresh), video_id)


def _respond(operation, video_id=None):
    try:
        return Response(operation())
    except AnalysisRun.DoesNotExist:
        return Response({'error': 'This comment snapshot expired. Refresh comments to continue.'}, status=404)
    except SnapshotChanged as error:
        return Response({'error': str(error)}, status=409)
    except InsufficientComments as error:
        return Response({'error': str(error)}, status=400)
    except HttpError as error:
        try:
            reason = json.loads(error.content)['error']['errors'][0]['reason']
        except (ValueError, KeyError, IndexError, TypeError):
            reason = ''
        if reason in ('commentsDisabled', 'videoNotFound'):
            Video.objects.filter(pk=video_id).delete()
            AnalysisRun.objects.filter(video_id=video_id).delete()
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


@api_view(['POST'])
def analyze(request):
    # Compatibility endpoint for older clients.
    return _analyze_request(request, analyze_video)


@api_view(['POST'])
def prepare(request):
    return _analyze_request(request, prepare_analysis)


@api_view(['POST'])
def topics(request, run_id):
    return _respond(lambda: analyze_topics(run_id))


@api_view(['POST'])
def opinions(request, run_id):
    return _respond(lambda: analyze_opinions(run_id))
