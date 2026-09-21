# CommentLens

CommentLens groups YouTube comments into audience topics using a React dashboard,
a Django REST API, and a Python NLP pipeline. The current API fetches **up to 50
top-level comments per analysis**, cleans them, embeds them with
`all-MiniLM-L6-v2`, reduces dimensions with UMAP, and groups them with HDBSCAN.
Topics include representative comments and are ranked using cluster size and likes.

## Prerequisites

- Git.
- **Python 3.11** (the repository's `backend/runtime.txt` specifies 3.11.9).
  Use the 3.11 series for the pinned scientific packages; newer Python versions
  may lack compatible wheels.
- **Node.js 22.13+ on the 22.x line, or Node.js 24+**, with npm. This covers the
  Vite 8 and ESLint 10 requirements recorded in the lockfile.
- A Google Cloud project with **YouTube Data API v3** enabled and an API key.
- Internet access for package installation, YouTube requests, and the initial
  sentence-transformer model download. The ML dependencies require substantial
  disk space and memory; the first analysis can take longer while downloading
  the model and compiling numerical routines.
- A C/C++ compiler may be needed if pip builds `hdbscan` from source (on Windows,
  Microsoft C++ Build Tools; on macOS, Xcode command-line tools; on Linux, your
  distribution's compiler/development packages).

SQLite is used locally; no separate database server is required.

## Clone

```sh
git clone https://github.com/RosarioDiBartolo/CommentLens.git
cd CommentLens
```

## Backend setup

Run from the repository root. On macOS/Linux:

```sh
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` before starting Django:

1. In [Google Cloud Console](https://console.cloud.google.com/), select/create
   a project, enable **YouTube Data API v3** under APIs & Services > Library,
   and create an API key under APIs & Services > Credentials. Restrict the key
   to YouTube Data API v3. Any application restrictions must permit requests
   from the backend; browser-referrer restrictions do not suit this server client.
2. Replace `YOUTUBE_API_KEY` with your key. Keep it on the backend only.
3. Generate a fresh Django secret with the following command, then paste the
   result into `DJANGO_SECRET_KEY` in `backend/.env`:

```sh
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Keep `DEBUG=True` for local development. Then, from `backend/` with the virtual
environment active:

```sh
python manage.py migrate
python manage.py check
python manage.py runserver localhost:8000
```

Leave this terminal running. Open **http://localhost:8000/** to see a JSON
response with `status: online`. The analysis endpoint is
`POST http://localhost:8000/api/analyze/` with a JSON body containing `url`.
Visiting that endpoint in a browser uses GET and will not run an analysis.

## Frontend setup

Open a **second terminal**, starting at the repository root:

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev -- --port 5173 --strictPort
```

In PowerShell use `Copy-Item .env.example .env` for the copy step.
The example sets `VITE_API_BASE_URL=http://localhost:8000`. Open
**http://localhost:5173/** and submit a public YouTube video URL with enabled
comments and enough meaningful text. Both servers must remain running.

Use the backend **origin**, without `/api` or `/api/analyze/`. The frontend
appends `/api/analyze/` and removes trailing slashes from the configured origin.
Restart Vite after editing its environment file.

### Frontend checks and build

From `frontend/`:

```sh
npm run lint
npm run build
npm run preview -- --port 4173 --strictPort
```

The output is `frontend/dist/`. Preview serves it at **http://localhost:4173/**
and still needs the backend. Vite embeds environment variables at build time:
set the backend URL before building and rebuild when it changes. Preview and
Django's development server are local development tools, not production servers.

## Environment variables

| Variable | Location | Purpose |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | `backend/.env` or backend process environment | Required for YouTube analysis; no key is bundled. |
| `DJANGO_SECRET_KEY` | `backend/.env` or backend process environment | Required at Django startup; generate your own value. |
| `DEBUG` | `backend/.env` or backend process environment | Exact value `True` enables debug; default is `False`. |
| `VITE_API_BASE_URL` | `frontend/.env` or frontend build/dev environment | Backend origin; defaults to `http://localhost:8000`. Public, not a secret. |
| `VITE_API_URL` | Frontend environment (legacy) | Backward-compatible fallback if `VITE_API_BASE_URL` is unset or blank. |

The backend loads `backend/.env` by its absolute location, independently of the
working directory. Existing process environment variables take precedence.
Vite also supports mode-specific environment files such as `.env.production`.
All `VITE_` values are visible in the browser: never place API keys or Django
secrets in the frontend environment.

Real `.env` files, their mode/local variants, virtual environments, SQLite data,
and model caches are ignored by Git. Only placeholder `.env.example` files
should be committed. Copy examples only on first setup to avoid overwriting
existing credentials.

**Existing deployments:** a Django secret was previously committed in source.
Treat it as exposed and replace it wherever it was used, supplying the new value
through `DJANGO_SECRET_KEY`. Removing it from the current source does not remove
it from Git history. This change does not rotate credentials or rewrite history.
Existing deployments using `VITE_API_URL` remain supported; prefer
`VITE_API_BASE_URL` for new configuration.

## Project structure

```text
CommentLens/
├── README.md
├── backend/
│   ├── .env.example         # Backend configuration template
│   ├── manage.py           # Django management commands
│   ├── requirements.txt    # Pinned Python dependencies
│   ├── runtime.txt         # Python runtime reference
│   ├── backend/            # Django settings and root routes
│   ├── api/                # POST /api/analyze/ view and routes
│   └── pipeline/           # YouTube ingestion, cleaning, embedding, clustering
└── frontend/
    ├── .env.example         # Public backend-origin setting
    ├── package.json         # npm commands and dependencies
    ├── package-lock.json    # Reproducible npm install
    ├── vite.config.js       # Vite + React configuration
    └── src/                 # Dashboard and styles; App.jsx calls the API
```

## Processing details

The existing pipeline keeps display text separate from normalized embedding
text. It removes markup, links, common engagement spam, and comments with fewer
than four words or an ASCII ratio below 0.65; this is a heuristic, not language
detection. Sentence embeddings have 384 dimensions. UMAP uses up to five output
dimensions, adjusted for small samples, followed by HDBSCAN density clustering.
Noise points are excluded from returned topics. Each topic includes up to three
comments closest to its centroid and a title derived from frequent words.

## Troubleshooting

- **Python dependency installation fails:** check `python --version` inside the
  activated environment; use Python 3.11 and upgrade pip. Install compiler tools
  if the error concerns building HDBSCAN. The pinned dependencies are preserved;
  do not assume they support the newest Python.
- **PowerShell blocks activation:** use `.\.venv\Scripts\python.exe` instead of
  `python` for each backend command; activation is optional when invoking the
  virtual environment interpreter directly.
- **Node engine errors:** verify `node --version` against the prerequisites,
  then rerun `npm ci`.
- **Missing `DJANGO_SECRET_KEY`:** copy the backend example, generate a value,
  and set it in `backend/.env`. Django intentionally refuses to start without it.
- **Missing key / YouTube API error:** set `YOUTUBE_API_KEY` in `backend/.env`,
  enable YouTube Data API v3 for its project, check key restrictions, and restart
  Django. A missing YouTube key allows the health endpoint to work but analysis
  fails. Quota exhaustion returns a 503; check the project's API quota.
- **Frontend cannot reach backend:** first open http://localhost:8000/, then
  check `VITE_API_BASE_URL`, port, and protocol. Do not append `/api`. Restart
  Vite after changing `.env`; rebuild deployed assets. An HTTPS frontend needs
  an HTTPS backend to avoid mixed-content blocking.
- **CORS or host errors:** local `localhost` and `127.0.0.1` are allowed. The
  current settings allow all CORS origins and retain existing deployment hosts
  and CSRF origins. For other hosts/deployment origins, review `ALLOWED_HOSTS`,
  `CSRF_TRUSTED_ORIGINS`, and CORS settings in `backend/backend/settings.py`;
  these existing deployment settings are not a production-hardening guide.
- **Port already used:** stop the conflicting process or pick another port.
  If the backend port changes, update `VITE_API_BASE_URL` accordingly. The
  documented Vite command fails explicitly instead of silently changing ports.
- **Slow first analysis / model download fails:** allow the Hugging Face model
  download and enough disk/memory. The backend uses `backend/ml_cache/` and
  `backend/numba_cache/`; later requests can reuse caches.
- **Disabled comments / too few comments:** choose another public video. The
  API requires at least 10 fetched comments and five after cleaning. Sparse
  samples can still produce no clusters; the frontend does not analyze replies
  or every comment on a large video.
