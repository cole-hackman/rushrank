# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RushRank — fraternity rush management app. Next.js 14 frontend (`frontend/`) + FastAPI Python backend (`python_server/`) + Supabase Postgres.

## Commands

### Frontend (cd `frontend/`)
- `npm run dev` — Next.js dev server on port 3000
- `npm run build` / `npm start`
- `npm run lint` — Next lint
- `npm run typecheck` — `tsc --noEmit`

### Backend (repo root)
- `python run_fastapi.py` — uvicorn on port 8000 with reload
- Direct: `uvicorn python_server.main:app --host 0.0.0.0 --port 8000 --reload`
- Install deps: `pip install -r python_server/requirements.txt` (or `uv pip install ...`)
- Tests: `cd python_server && pytest` (config in `python_server/pytest.ini`, async mode auto)
- Single test: `pytest tests/test_voting.py::test_name -v`
- API docs while running: `http://localhost:8000/docs`

### Database
- Schema lives in `supabase/schema.sql` plus numbered files in `supabase/migrations/` (0001–0008).
- Apply: `npx supabase db push` or `psql "$DATABASE_URL" -f supabase/schema.sql`.
- Migrations are append-only and numerically ordered; create the next file rather than editing past ones.

## Architecture

### Two-tier split
- **Frontend** is a standalone Next.js 14 app under `frontend/` with its own `package.json`, `tsconfig.json`, and `node_modules`. It talks to the FastAPI backend over HTTP and to Supabase directly for auth + realtime + storage.
- **Backend** is a FastAPI app (`python_server/main.py`) that owns all business logic and DB writes. It validates Supabase JWTs (JWKS) on every protected request.
- The **root `package.json`** is stale leftover from a previous Express/Drizzle stack (references `server/index.ts` which no longer exists). Do not use root `npm run dev`/`build`; the live stack is `frontend/` + `python_server/`.

### Backend layering (`python_server/`)
- `main.py` — FastAPI app, CORS, lifespan-managed asyncpg pool, path normalization middleware, global exception handler that re-applies CORS headers on 500s, WebSocket endpoint at `/ws/session/{session_id}`.
- `routes.py` — all HTTP endpoints; thin handlers that delegate to service classes.
- `services.py` — `UserService`, `ChapterService`, `PNMService`, `VotingService`, `EventService`, `ExportService`, `NoteService`, `TagService`, `SessionService`, `UploadService`, `QuestionnaireService`, `InvitationService`. All DB access flows through these.
- `auth.py` — Supabase JWT verification via JWKS; `get_current_user` / `get_optional_user` dependencies.
- `database.py` — global asyncpg pool, `get_db` dependency.
- `websocket.py` — `ws_manager` broadcasts session events (`pnm_advance`, `lock_change`, `vote_cast`, `session_ended`) to subscribed clients.
- `rate_limit.py`, `cache.py`, `exceptions.py` — cross-cutting concerns wired in `main.py`.
- Routes are mounted under both `/api/v1` (canonical) and `/api` (backward compat) — keep this dual mount when adding routes.

### Frontend (`frontend/`)
- App Router. Authenticated app lives under `app/(dashboard)/` (admin, analytics, compare, events, exports, pnms, profile, results, rush, settings, voting). Public/auth routes: `app/login`, `app/intake`, `app/demo*`.
- `lib/api.ts` — HTTP client; resolves base URL from `NEXT_PUBLIC_API_BASE_URL` (or legacy `NEXT_PUBLIC_API_URL`) and appends `/api` if missing. JWT pulled from `localStorage.access_token`. Chapter ID is cached in localStorage with 24h TTL.
- `lib/supabaseClient.ts`, `lib/realtime.ts` — direct Supabase client for auth + realtime subscriptions.
- `lib/queries.ts` — react-query hooks layered on top of `api.ts`.
- UI uses Subframe + Radix + Tailwind. `frontend/ui/` contains generated Subframe components.

### Data model
- Multi-tenant by `chapter_id`. Core tables: `users`, `chapters`, `memberships` (role: admin/exec/member), `pnms`, `voting_rounds`, `votes`, `notes`, `events`, `attendance`, plus session/questionnaire/tag/invitation tables added via migrations.
- RLS policies enforce chapter isolation in Supabase; backend additionally uses service role key for cross-row operations.

### Live voting flow
Voting sessions are the performance-critical path: chair advances PNMs via the backend, which writes to `votes` and broadcasts over the websocket. Mobile swipe UI in `app/(dashboard)/voting/`. When changing voting logic, check both `VotingService`/`SessionService` and the websocket broadcast contract.

## Environment

- Root `.env` — backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`, `ALLOWED_ORIGINS` (CSV, no trailing slashes).
- `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_BASE_URL`.
- `main.py` has its own minimal `.env` loader; it reads root `.env` and `backend/.env` without overriding existing env vars.

## Deployment

Frontend → Vercel (root directory set to `frontend`). Backend → Render (`render.yaml` Blueprint, builds from `python_server/requirements.txt`). After deploy, update Render's `ALLOWED_ORIGINS` to include the Vercel domain. See `DEPLOYMENT.md`.
