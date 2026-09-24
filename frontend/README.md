# CommentLens frontend

React 19 with Vite 8. Use Node.js 22.13+ on the 22.x line, or Node.js 24+,
and npm. Run these commands from `frontend/`:

```sh
npm ci
cp .env.example .env
npm run dev -- --port 5173 --strictPort
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Open http://localhost:5173 and keep the backend running in a separate terminal.

Set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env` to point to
your Django backend. Use its origin only, without `/api`; the app appends
`/api/analyze/`. Trailing slashes are accepted. The default is
`http://localhost:8000`. The legacy `VITE_API_URL` is still supported when
`VITE_API_BASE_URL` is unset or blank.

Restart Vite after changing environment variables. For deployments, set the
variable before building and rebuild after changes. Every `VITE_` variable is
public browser configuration: never add YouTube keys or other secrets here.

```sh
npm test
npm run lint
npm run build
npm run preview -- --port 4173 --strictPort
```

The build output is `dist/`; preview is at http://localhost:4173 and still
requires a running backend. Preview is for checking a build locally.

See the [repository setup guide](../README.md) for backend installation,
YouTube credentials, environment variables, and troubleshooting.

Each topic has Most representative / Most liked controls. Comments show author
and likes; Show more reveals additional members without another API call. The
representative view starts with the closest comment plus five neighbours; the
likes view starts with five. Last fetched identifies the saved snapshot, and
Refresh comments explicitly fetches updated data. The database cache is shared
by users of this backend; see the root README for expiry and persistence.

## Architecture

The frontend is a client-rendered React/Vite application with strict TypeScript.
Django remains responsible for persistence, YouTube access, and inference.

- `src/App.tsx`: provider composition and selection of the current screen.
- `src/features/analysis/model.ts`: Zod response schemas and inferred domain types.
- `src/features/analysis/api.ts`: the HTTP boundary; validates unknown responses and normalizes errors.
- `src/features/analysis/useAnalysis.ts`: comment preparation followed by independent topic/opinion tasks.
- `src/features/analysis/useAnalysisTask.ts`: isolated TanStack Query mutation lifecycle, duplicate submission guard, cancellation, and the last successful result.
- `src/features/analysis/components/`: input, workspace, topics, comments, and opinion components, styled with a feature CSS Module.
- `src/index.css`: shared design tokens and global accessibility defaults.

Submitting opens the workspace immediately. There is no timed progress screen,
percentage estimate, or combined loading state. A shared comment preparation
request creates an immutable snapshot; topic and opinion requests then start in
parallel. Each panel displays its own pending state, error, result, and retry.
An opinion retry never runs embeddings/clustering or refetches YouTube comments.
Opinion results and classified comments remain usable even if topic discovery
fails or there are too few comments to cluster.

`POST /api/runs/` takes `{ url, refresh }` and returns a `run_id` plus video metadata.
`POST /api/runs/<run_id>/topics/` and `/opinions/` process that same snapshot.
The original `/api/analyze/` endpoint remains available for older clients.

Automatic retries are disabled because requests can trigger expensive work.
Client cancellation stops listening; it does not guarantee the server has stopped.
New analysis aborts all current requests and discards late responses. Refresh
keeps the previous results until a fresh snapshot is ready, then restarts both
panels. A failed comment refresh preserves the current panels, including tasks
still running. No result is persisted in browser storage.

Deploy the backend and run `python manage.py migrate` before deploying this
frontend; migration 0003 adds the snapshot table. Snapshots expire with the
existing 29-day retention policy. Serve Django with concurrent request capacity
(e.g. multiple workers/threads) so one long analysis does not queue the other.

The current app has one workflow, so it does not need a router or a global state
store. Add routes when distinct, addressable pages are introduced. Keep UI-only
state (sorting, expansion, URL input) local to its component.

## Verification

`npm run check` runs strict type checking, lint, component/API/lifecycle tests,
and a production build. The existing JavaScript behavior tests remain in place;
new API and lifecycle tests use TypeScript.

Browser checks use mocked HTTP responses so they require no YouTube credentials,
model download, or running Django server:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts its own Vite server on port 5175 and checks desktop and mobile
workflows. GitHub Actions runs these checks on frontend changes.

## Cluster explorer

The analysis workspace follows the supplied bubble-map prototype using the existing
ivory/coral palette, DM Sans/Lora fonts, and CSS modules. The repository has no
Tailwind or dark-theme token set. `explorer.module.css` uses the application tokens;
cluster identity colors reuse the former topic-card palette. Lucide supplies icons,
and the shared Collapsible wrapper uses the Radix primitive used by shadcn/ui.

`clusterView.ts` joins opinion answers to topic comments by `comment_id`. Cluster
sentiment is the highest average probability among classified members, with ties
and missing classifications marked unclassified. Coverage is shown in expanded
cards. Search uses labels and keywords; sentiment sorting groups positive, neutral,
negative, then unclassified clusters, with volume and ID as deterministic tie-breakers.

No prototype data is shipped. Until the API supplies dedicated keywords, `Topic:`
labels are split into the keywords already extracted by the backend and marked
"From topic label". Optional `published_at` and `replies` are accepted, but the
current backend does not send them: the UI explicitly displays unavailable values.
No channel, view count, thumbnail, or generated video summary is fabricated.

Bubble geometry is computed separately from domain data. Area represents volume;
position does not encode semantic similarity. Filtering dims excluded bubbles
without moving the layout; those bubbles are disabled and removed from tab order.
Map, legend, and cards share expansion and hover/focus state. Filters retain expanded
IDs and Collapse all clears every expansion, including hidden clusters. A new
analysis resets explorer state. The map starts collapsed on tablet/mobile; opinion
reports follow the cluster browser at those widths.

`npm run check` covers TypeScript, lint, unit tests and production build.
`npm run test:e2e` covers desktop/mobile interactions, keyboard activation, reduced
motion, filter totals, empty states, comment ordering, and independent request failures.
Browser tests use intercepted API fixtures only; production uses the live endpoints.
