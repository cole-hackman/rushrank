# RushRank Monorepo

Mono-repo with a Next.js frontend and a FastAPI backend, using Supabase Postgres with raw SQL migrations.

## Prerequisites
- Node.js (v20 recommended)
- Python 3.11+
- Supabase CLI (via `npx`)
- `psql` for running seeds against a database URL

## Environment
Populate env files for frontend and backend:

Frontend (`frontend/.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Backend (`.env` or `backend/.env`):

```
DATABASE_URL=postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWKS_URL=...
```

Examples are provided at:
- `frontend/env.example`
- `backend/env.example`

## Database
See `docs/db/README.md` for migration and seeding commands. TL;DR:

```
npx supabase init
npx supabase db push           # apply migrations
psql "$DATABASE_URL" -f db/seed_dev.sql
```

## Running locally

- Frontend (Next.js):
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

- Backend (FastAPI):
  ```bash
  # Option A
  python run_fastapi.py

  # Option B (equivalent)
  uvicorn python_server.main:app --reload
  ```

## CI
GitHub Actions workflow runs frontend typecheck/build and backend tests on pushes and PRs. See `.github/workflows/ci.yml`.


