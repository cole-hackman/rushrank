# e2e runbook (short form)

The full plan, with the page and endpoint inventory, expected results and troubleshooting, is in [`docs/reboot-2026-11/06-test-plan.md`](../docs/reboot-2026-11/06-test-plan.md). This page is the command list.

**Never run anything here against production.** Production holds real member data. `seed.py` truncates 18 tables on whatever database it is given, so always go through `guard.py`.

**The six new scripts (`guard.mjs`, `guard.py`, `ws-voting.mjs`, `api-contract.mjs`, `roles.mjs`, `flows.mjs`) were run once, on 11 Nov 2026, in a Linux container against a local Postgres 16. They have not been run on macOS.** Expect to adjust a selector or a delay on the first run.

## Setup, once

From the repository root:

```bash
createdb rushrank_e2e
```

```bash
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d rushrank_e2e -f "$f" || break; done
```

```bash
python3.11 -m venv .venv && source .venv/bin/activate && pip install -r python_server/requirements.txt -r python_server/requirements-dev.txt
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
| 2 | `node roles.mjs` | no | `88 page loads`, `0 new` (6 known) | |
| 3 | `node visual.mjs` | no | `0 visual finding(s)`; screenshots in `screens/` | |
| 4 | `node ws-voting.mjs 24 4` | yes | `59 checks passed`, `0 new blocker/high` (4 known) | |
| 5 | `node guard.mjs --api && node voting.mjs 24` | yes | `0 finding(s)` | Reseed |
| 6 | `node api-contract.mjs` | yes, deletes | `286 assertions`, `FAILED 0`, `uncovered 0` (12 known, 9 external) | Reseed |
| 7 | `node flows.mjs` | yes | `7 ok, 3 known defect(s), 0 new failure(s)` | Reseed |
| 8 | `node guard.mjs --api && node crawl.mjs` | yes | `report-crawl.json` | Reseed |
| 9 | `node guard.mjs --api && node destructive.mjs` | deletes | `6/6 checks passed` | Reseed |
| 10 | `node guard.mjs --api && node verify-changes.mjs` | yes | `12 passed, 0 failed` | Reseed |

The new scripts (2, 4, 6, 7) call the guard themselves. The existing ones (5, 8, 9, 10) do not, which is why `node guard.mjs --api &&` is in front of each.

Exit codes for the new scripts: `0` nothing new, `1` a new failure, `2` the guard refused. Findings tagged `known` are defects already written up in `docs/reboot-2026-11/02-unfinished-and-broken.md` and do not fail the run.

Reports are written to `e2e/report-*.json` (git-ignored).

## Backend and frontend unit tests

```bash
cd python_server && pytest -q -m "not integration"
```

```bash
TEST_DATABASE_URL=postgresql://$(whoami)@localhost:5432/postgres pytest -q -m integration
```

Expected: `84 passed`, then `153 passed`. The integration suite creates and drops its own databases (`rr_it_fresh`, `rr_it_legacy`, `rr_it_demo`). Only ever point `TEST_DATABASE_URL` at local Postgres.

```bash
cd frontend && npm run lint && npm run typecheck && npm run test
```
