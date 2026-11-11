# e2e runbook (short form)

The full plan, with the page and endpoint inventory, expected results and troubleshooting, is in [`docs/reboot-2026-11/06-test-plan.md`](../docs/reboot-2026-11/06-test-plan.md). This page is the command list.

**Never run anything here against production.** Production holds real member data. `seed.py` truncates 18 tables; it refuses anything but a local `_e2e` or `_test` database.

**Every suite here was run on macOS (Python 3.13, Node 26, PostgreSQL 17) on 12 Nov 2026 and passed with the results in the table below.**

If something else is already listening on port 3000, start the frontend on another port (`npx next start -p 3100`), add that origin to `ALLOWED_ORIGINS` for the backend, and export `E2E_APP_URL=http://localhost:3100` in terminal C.

## Setup, once

From the repository root:

```bash
createdb rushrank_e2e
```

```bash
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d rushrank_e2e -f "$f" || break; done
```

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r python_server/requirements.txt -r python_server/requirements-dev.txt
```

```bash
cd e2e && npm install && npx playwright install chromium && cd ..
```

## Every session

**Terminal A, backend:**

```bash
source .venv/bin/activate && set -a && . ./e2e/env.sh && set +a && uvicorn python_server.main:app --host 127.0.0.1 --port 8000
```

**Terminal B, frontend** (move `frontend/.env.local` aside first if it exists):

```bash
cd frontend && npm ci && NEXT_PUBLIC_SUPABASE_URL=https://e2elocal.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-local-anon NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build && npx next start -p 3000
```

**Terminal C, tests:**

```bash
source .venv/bin/activate && set -a && . ./e2e/env.sh && set +a
```

Confirm the target, then seed. The first command only checks; the second truncates and reseeds:

```bash
python3 e2e/guard.py
```

```bash
python3 e2e/guard.py --seed
```

Confirm the running backend is on that same database. Do this before anything that writes:

```bash
cd e2e && node guard.mjs --api
```

You should see `guard: database OK -> …@localhost:5432/rushrank_e2e` and `guard: backend OK -> http://localhost:8000 serves seed chapter <uuid>`. If you see `GUARD REFUSED`, stop and read the reason.

## Suites

Run from `e2e/`. "Reseed" means `cd .. && python3 e2e/guard.py --seed && cd e2e`.

| Order | Command | Writes | Expected | Then |
|---|---|---|---|---|
| 1 | `node smoke.mjs` | no | `redirected to login: false`, `errors : 0` | |
| 2 | `node roles.mjs` | no | `88 page loads`, `0 new` (5 known) | |
| 3 | `node visual.mjs` | no | `0 visual finding(s)`; screenshots in `screens/` | |
| 4 | `node ws-voting.mjs 24 4` | yes | `63 checks passed`, `0 new blocker/high` (2 known) | |
| 5 | `node voting.mjs 24` | yes | `0 finding(s)` | Reseed |
| 6 | `node api-contract.mjs` | yes, deletes | `285 assertions`, `FAILED 0`, `uncovered 0` (2 known, 8 external) | Reseed |
| 7 | `node flows.mjs` | yes | `12 flows: 10 ok, 2 known defect(s), 0 new failure(s)` | Reseed |
| 8 | `node crawl.mjs` | yes | `report-crawl.json` | Reseed |
| 9 | `node destructive.mjs` | deletes | `6/6 checks passed` | Reseed |
| 10 | `node verify-changes.mjs` | yes | `12 passed, 0 failed` | Reseed |

Every script that writes calls the guard itself and exits with code 2 if the database or the backend is not the local e2e one. `seed.py` does the same, so it cannot be pointed at a real database even when run directly.

Exit codes for the new scripts: `0` nothing new, `1` a new failure, `2` the guard refused. Findings tagged `known` are defects already written up in `docs/reboot-2026-11/02-unfinished-and-broken.md` and do not fail the run.

Reports are written to `e2e/report-*.json` (git-ignored).

## Backend and frontend unit tests

```bash
cd python_server && pytest -q -m "not integration"
```

```bash
TEST_DATABASE_URL=postgresql://$(whoami)@localhost:5432/postgres pytest -q -m integration
```

Expected: `88 passed`, then `177 passed`. The integration suite creates and drops its own databases (`rr_it_fresh`, `rr_it_legacy`, `rr_it_demo`). Only ever point `TEST_DATABASE_URL` at local Postgres.

```bash
cd frontend && npm run lint && npm run typecheck && npm run test
```
