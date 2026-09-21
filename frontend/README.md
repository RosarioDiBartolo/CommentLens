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
