from pathlib import Path
import os
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Cache directories inside the project so they persist after the build phase
os.environ["HF_HOME"] = str(BASE_DIR / "ml_cache")
os.environ["NUMBA_CACHE_DIR"] = str(BASE_DIR / "numba_cache")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY in backend/.env or the environment.")

DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    "commentlens-2uqw.onrender.com",
    "localhost",
    "127.0.0.1",
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'api',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]
CSRF_TRUSTED_ORIGINS = [
    "https://comment-lens-alpha.vercel.app",
    "https://commentlens-2uqw.onrender.com",
]
# Fresh analysis results may be reused for one day. Raw API data is purged after 29 days.
ANALYSIS_CACHE_TTL_SECONDS = int(os.getenv('ANALYSIS_CACHE_TTL_SECONDS', '86400'))
if not 0 <= ANALYSIS_CACHE_TTL_SECONDS < 29 * 24 * 60 * 60:
    raise ImproperlyConfigured('ANALYSIS_CACHE_TTL_SECONDS must be between 0 and 2505599.')

# The provider is opt-in. A host change never requires application code changes.
DECISION_PROVIDER = os.getenv('DECISION_PROVIDER', 'disabled').strip().lower()
KEV_BASE_URL = os.getenv('KEV_BASE_URL', '').strip().rstrip('/')
KEV_MODEL = os.getenv('KEV_MODEL', 'kev-latest').strip()
KEV_MODEL_VERSION = os.getenv('KEV_MODEL_VERSION', '1').strip()
KEV_API_KEY = os.getenv('KEV_API_KEY', '').strip()
KEV_TIMEOUT = float(os.getenv('KEV_TIMEOUT', '30'))
KEV_ANALYSIS_BUDGET = float(os.getenv('KEV_ANALYSIS_BUDGET', '120'))
if DECISION_PROVIDER not in ('disabled', 'kev', 'mock'):
    raise ImproperlyConfigured('DECISION_PROVIDER must be disabled, kev, or mock.')
if not (0 < KEV_TIMEOUT <= 120 and 0 < KEV_ANALYSIS_BUDGET <= 600):
    raise ImproperlyConfigured('KEV_TIMEOUT must be 0–120 seconds and KEV_ANALYSIS_BUDGET 0–600 seconds, exclusive of zero.')
if DECISION_PROVIDER == 'kev':
    from urllib.parse import urlsplit
    endpoint = urlsplit(KEV_BASE_URL)
    if (endpoint.scheme not in ('http', 'https') or not endpoint.hostname
            or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment):
        raise ImproperlyConfigured('Set KEV_BASE_URL to an HTTP(S) server URL without credentials, query, or fragment.')
    if not KEV_MODEL:
        raise ImproperlyConfigured('KEV_MODEL cannot be empty.')
