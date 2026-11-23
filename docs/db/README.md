# Database setup (Supabase + SQL migrations)

This repo uses Supabase-compatible raw SQL migrations. The canonical DDL lives in:

- `supabase/migrations/0001_init.sql` (tables, constraints, enums)
- `supabase/migrations/0002_views_indexes.sql` (indexes, views, materialized views)
- Seed data for local/dev: `db/scripts/seed_demo.py`

## Prerequisites

- Node.js and npm
- Supabase CLI (installed on-demand via `npx`)
- psql (for applying migrations to a local Postgres)

## Local workflow (Supabase CLI)

Initialize Supabase locally (one-time):

```bash
npx supabase init
```

Start the local containers and apply new migrations to them:

```bash
npx supabase start
npx supabase migration up --local
```

Reset the local database (drops it and re-applies every migration). Always pass `--local`:

```bash
npx supabase db reset --local
```

Without the Supabase CLI, on a local Postgres:

```bash
for f in supabase/migrations/*.sql; do psql -h localhost -d rushrank -v ON_ERROR_STOP=1 -q -f "$f" || break; done
```

## Remote database

> **WARNING: these commands change the database the live app uses.** `supabase db push` without `--local` goes to the linked remote project. Migrations cannot be undone, and some delete rows (`0013_reconcile_schema.sql` deletes from `memberships` and `users`). Take a backup, check the list with `--dry-run`, and have the project owner run it. Never run `supabase db reset` with `--linked` or `--db-url`: it drops everything.

```bash
npx supabase db push --dry-run   # lists what would be applied
npx supabase db push
```

## Seeding dev data

On a local database only:

```bash
DATABASE_URL=postgresql://localhost:5432/rushrank python db/scripts/seed_demo.py
```

`db/seed_dev.sql` was written for an older schema and no longer applies.

## Notes

- The file `supabase/schema.sql` may exist for reference, but the source of truth is the migration files in `supabase/migrations/`.
- The seed contains synthetic development data. Do not run it against production.

## Future Alembic (optional)

We removed Alembic to avoid migration drift while standardizing on raw SQL. If we reintroduce Alembic later:

- Mirror the existing SQL schema into SQLAlchemy models.
- Use `alembic revision --autogenerate -m "..."` to produce diffs.
- Ensure Alembic versions only complement, not conflict with, the SQL migrations (one strategy: use Alembic locally to generate SQL, then commit finalized SQL into `supabase/migrations/`).

# RushRank Database Migrations

This repo ships Supabase/Postgres SQL migrations first, with a full Alembic fallback.

## Supabase (preferred)

Prereqs:
- Supabase CLI installed and logged in.
- Postgres available (Supabase local or remote).

Apply migrations locally:
```bash
npx supabase db reset --local   # drops and recreates the local schema, applies migrations in order
```

For a remote project, see the warning under [Remote database](#remote-database).

Files:
- `supabase/migrations/0001_init.sql` — core schema, enums, constraints.
- `supabase/migrations/0002_views_indexes.sql` — indexes, materialized view, ranking/anonymity views, RLS scaffolding (commented).
- `db/seed_dev.sql` — old dev seed, no longer applies.

Refresh the materialized view:
```sql
SELECT refresh_mv_pnms_search();
```

### Notes on Anonymity
- Public votes are exposed via `v_votes_public`. When `voting_rounds.settings->>'anonymous' = 'true'`, `voter_user_id` is masked (`NULL`), but vote values remain for aggregation.
- Rankings view `v_round_rankings` computes weighted scores using `settings.execWeight` when `users.is_exec = true`.

### Performance
- Trigram index on `pnms.name` (pg_trgm).
- Composite index on `(chapter_id, name)`.
- GIN index on `mv_pnms_search.document`.
- Target: search < 300ms for 5k PNMs.

## Alembic (fallback)

If you prefer Python migrations:

Setup:
```bash
python -m venv .venv && source .venv/bin/activate
pip install alembic psycopg[binary]==3.*  # or psycopg2
export DATABASE_URL="postgresql://user:pass@localhost:5432/rushrank"
```

Apply:
```bash
cd backend
alembic upgrade head
```

Files:
- `backend/alembic.ini` — Alembic configuration (reads `DATABASE_URL`).
- `backend/alembic/env.py` — connection setup.
- `backend/alembic/versions/0001_init.py` — DDL parity with `0001_init.sql` (upgrade/downgrade).

## Safety Checklist (Prod)
- Automated daily backups; PITR if available.
- Enable `pg_stat_statements`; monitor slow queries.
- Connection pooling via PgBouncer.
- RLS if directly exposing Postgres; if proxying via FastAPI, enforce auth/roles server-side.
- Migrate using transactional DDL; test on staging datasets.

## ERD
The Mermaid ERD is at `docs/db/ERD.mmd`. Render with any Mermaid viewer or VS Code extension.

