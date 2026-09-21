import os
from pathlib import Path
from dotenv import load_dotenv
from googleapiclient.discovery import build
import re
from urllib.parse import urlparse, parse_qs

# explicitly load .env from backend/ folder regardless of where script runs from
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

API_KEY = os.getenv("YOUTUBE_API_KEY")

if not API_KEY:
    import warnings
    warnings.warn("YOUTUBE_API_KEY not found. YouTube features will not work.")


def extract_video_id(value):
    if not isinstance(value, str):
        raise ValueError('Enter a valid YouTube video URL or ID.')
    value = value.strip()
    if re.fullmatch(r'[a-zA-Z0-9_-]{11}', value):
        return value
    parsed = urlparse(value if '://' in value else 'https://' + value)
    host = (parsed.hostname or '').lower()
    parts = parsed.path.strip('/').split('/')
    video_id = ''
    if parsed.scheme in ('http', 'https'):
        if host in ('youtu.be', 'www.youtu.be'):
            video_id = parts[0]
        elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'):
            if parsed.path == '/watch':
                video_id = parse_qs(parsed.query).get('v', [''])[0]
            elif len(parts) == 2 and parts[0] in ('shorts', 'embed', 'live'):
                video_id = parts[1]
    if not re.fullmatch(r'[a-zA-Z0-9_-]{11}', video_id):
        raise ValueError('Enter a valid YouTube video URL or ID.')
    return video_id


def get_comments(video_id_or_url, max_comments=100):
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise ValueError("YOUTUBE_API_KEY not set. Check your environment variables.")

    youtube = build("youtube", "v3", developerKey=api_key)

    video_id = extract_video_id(video_id_or_url)

    # get video title
    video_response = youtube.videos().list(
        part="snippet",
        id=video_id
    ).execute()
    title = video_response['items'][0]['snippet']['title'] if video_response['items'] else 'Unknown'
    channel = video_response['items'][0]['snippet']['channelTitle'] if video_response['items'] else 'Unknown'

    comments = []
    request = youtube.commentThreads().list(
        part="snippet",
        videoId=video_id,
        maxResults=100,
        textFormat="plainText"
    )

    while request and len(comments) < max_comments:
        response = request.execute()
        for item in response["items"]:
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            comments.append({
                "comment_id": item["snippet"]["topLevelComment"]["id"],
                "updated_at": snippet.get("updatedAt", ""),
                "text": snippet["textDisplay"],
                "likes": snippet["likeCount"],
                "author": snippet["authorDisplayName"],
                "video_title": title,
                "channel": channel,
            })
            if len(comments) >= max_comments:
                break
        request = youtube.commentThreads().list_next(request, response)

    return comments
