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
    └── src/                 # Typed dashboard, feature components, and validated API boundary
```

## Saved analyses and reusable embeddings

After pulling this feature, activate the backend virtual environment, install the
updated `requirements.txt`, and run `python manage.py migrate` from `backend/`.
The new Django tables live in the existing `backend/db.sqlite3`; no extra database
service is required. Keep that file on a **persistent local disk** for a deployed
single-instance backend. Ephemeral deployment filesystems lose this cache when
restarted/redeployed. Multiple backend instances should use a shared server database
such as PostgreSQL rather than separate SQLite files. This remains a synchronous
analysis service; large batches/background workers are outside this change.

Submit a previously analysed video URL to reopen its saved result. Equivalent
watch, short-link, Shorts, embed, and live URLs use the same canonical video ID.
Fresh results are reused for 24 hours by default, without calling YouTube or the
embedding model. Set `ANALYSIS_CACHE_TTL_SECONDS` in the backend environment to a
value from `0` to `2505599`; `0` always fetches fresh data. Restart Django after
changing it. The result shows when the comments were last fetched.

**Refresh comments** fetches the current sample and updates texts, authors, and
likes. Existing embeddings are reused when the comment ID, normalized-text hash,
model revision, and cleaning version match. New/edited normalized text is embedded
in a batch; a likes-only change does not require re-embedding. A model or cleaner
version change invalidates embeddings. A clustering/pipeline version change
recomputes clusters while reusing compatible vectors. Developers changing these
algorithms must bump the corresponding version constants. Original 384-dimensional
vectors are kept in `Embedding.vector` (`JSONField`), alongside `cleaned_text`,
`text_hash`, model/cleaner versions, and a foreign key to the matching comment.
Vectors stay on the server and can be reused through Django's ORM.

The database stores one current snapshot per video, including raw sampled comments,
cleaned embeddings, analysis metadata, clusters, and their comment memberships with
centroid similarities. A successful refresh atomically replaces that snapshot and
removes comments outside the new sample and obsolete vectors. Comments outside the
sample are not assumed to have been deleted on YouTube. A failed fetch/model/save
leaves the prior complete snapshot intact; a successful fetch with too few usable
comments clears the superseded result. This is a shared cache of public comments,
not private per-user storage or a permanent history/archive. Retention deletion
cascades through comments, embeddings, and clusters.

Within **every cluster**, choose:

- **Most representative:** the actual comment closest to the centroid is highlighted,
  followed by up to five more comments ordered by cosine similarity in the original
  embedding space. The centroid itself is an average vector, not a comment.
- **Most liked:** comments in that same cluster ordered by descending likes, showing
  five initially. Ties use comment ID for stable ordering.

Both views include text, author, and like count. **Show more** adds five comments;
**Show fewer** restores the initial limit. Changing the view is local to that cluster
and makes no network/model calls. Likes reflect the displayed fetch time, not live
counts. All clusters are accessible, and a no-clusters result has an explicit empty
state. The existing sample limit remains 50 top-level comments; replies are excluded.

### Cache API and maintenance

`POST /api/analyze/` accepts `{"url": "https://youtu.be/VIDEO_ID", "refresh": false}`.
Set `refresh` to JSON `true` to fetch again. The response adds `analysis_id`,
`video_id`, `cached`, `fetched_at`, and `analyzed_at`. Each cluster includes a
`comments` list with `comment_id`, `text`, `author`, `likes`, and `similarity`.
The legacy `top_comments` list of three strings is retained for existing clients.
Vectors are never serialized into this response. Analysis/cluster identifiers are
snapshot-local and may change on refresh.

Stored API data must be refreshed or removed within the applicable
[YouTube API retention limits](https://developers.google.com/youtube/terms/developer-policies#refreshing,-storing,-and-displaying-api-data).
The app purges snapshots aged 29 days (a one-day margin before 30 days) on analysis requests. **For deployments,
schedule the following command at least daily**, even when there is no traffic:

```sh
python manage.py purge_video_cache
```

Use a scheduler interval and retention margin appropriate to your deployment's
requirements; no scheduler is installed automatically. Backup retention also needs
to respect your data-retention policy. No cache database or fetched data is committed.

### Feature verification

```sh
# From backend/, with its virtual environment active and DJANGO_SECRET_KEY set:
python manage.py test api
python manage.py makemigrations --check --dry-run

# From frontend/:
npm ci
npm test
npm run lint
npm run build
```

Backend tests mock YouTube and embedding inference for repeatable cache tests, and
include a real UMAP/HDBSCAN smoke test. Frontend tests cover ordering, displayed
metadata, pagination, cache state, and refresh failure handling. UMAP 0.5.3 still
imports `pkg_resources`, so the dependency file pins compatible setuptools.

## Kev opinion analysis

CommentLens can run a second, independent decision pipeline on **all fetched
top-level comments**, including those excluded by the topic cleaner. It asks four
questions per comment: sentiment (positive/neutral/negative), explicit stance
(agrees/mixed/disagrees/unclear), genuine question (yes/no), and toxicity
(low/medium/high). Only the video title and comment are supplied; stance is not
fact checking or a comparison with a transcript. Questions live centrally in
`backend/pipeline/decision_analysis.py`.

Apply the database migration with `python manage.py migrate`, then add to
`backend/.env` and restart Django:

```dotenv
DECISION_PROVIDER=kev
KEV_BASE_URL=https://your-current-tunnel-or-server
KEV_MODEL=kev-latest
KEV_MODEL_VERSION=1
KEV_API_KEY=
KEV_TIMEOUT=30
KEV_ANALYSIS_BUDGET=120
```

Use the same server origin you checked in `backend/test.py`, without `/v1/models`.
The client posts to `/v1/systemone` using Kev's
[documented API](https://github.com/jaredpalmer/kev#api). An optional API key is sent
as a bearer token. Hosting changes require only `KEV_BASE_URL`; model checkpoint
changes behind an unchanged alias require bumping `KEV_MODEL_VERSION`. Keys remain
on the backend. No Kaggle-specific logic or inference model installation is needed
in CommentLens. `DecisionModel` defines the provider boundary; other providers can
return the same normalized answer format.

The default `DECISION_PROVIDER=disabled` preserves topic-only operation. Use
`DECISION_PROVIDER=mock` for offline development with fixed, explicitly labelled
demo probabilities. Demo fixtures never silently replace failed real inference.

The dashboard shows overall probabilities, per-topic summaries, and expandable
per-comment distributions. Percentages are the **mean model probabilities over
successfully classified comments**, with no likes weighting; they are not measured
viewer shares. Coverage is displayed. These experimental signals need evaluation
against manually labelled comments before interpreting them as reliable audience
measurements. The existing filtering metric is a heuristic, not model spam detection.

Results are stored in `Analysis.decision_data` and cascade with the video cache.
They are reused by comment ID, exact input text/title, provider/model identity and
question definitions. Changed text is reclassified; likes-only refreshes reuse
answers. Opinion settings do not invalidate embeddings or topic clusters.
`POST /api/analyze/` adds `decisions` with status, provider, model, coverage,
per-comment answers and summary. Each cluster adds `decision_summary`; classified
cluster comments add `decisions`. Existing response fields are preserved.

Inference remains synchronous and sequential. Requests time out after
`KEV_TIMEOUT` seconds (maximum 120); the pipeline stops starting requests when its
`KEV_ANALYSIS_BUDGET` (maximum 600 seconds) expires or after the first server error.
The HTTP timeout limits socket inactivity rather than providing a strict total
wall-clock deadline. Size deployment/proxy timeouts accordingly. Partial results
are saved and topic results remain available. **Retry opinion analysis** resubmits
the video without forcing a YouTube refresh and completes missing answers while
the comment cache is fresh. A stale cache follows the normal YouTube refresh rules.

Tests cover the HTTP contract, malformed probabilities, safe errors, deadlines,
offline mode, partial retries, persistence, cache invalidation, topic summaries,
and dashboard states. Run the backend and frontend verification commands above.

## Topic processing details

The existing pipeline keeps display text separate from normalized embedding
text. It removes markup, links, common engagement spam, and comments with fewer
than four words or an ASCII ratio below 0.65; this is a heuristic, not language
detection. Sentence embeddings have 384 dimensions. UMAP uses up to five output
dimensions, adjusted for small samples, followed by HDBSCAN density clustering.
Noise points are excluded from returned topics. Each topic includes all of its member comments, ordered by centroid similarity,
and a title derived from frequent words.

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
