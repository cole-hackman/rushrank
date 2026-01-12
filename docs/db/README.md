# Database setup (Supabase + SQL migrations)

This repo uses Supabase-compatible raw SQL migrations. The canonical DDL lives in:

- `supabase/migrations/0001_init.sql` (tables, constraints, enums)
- `supabase/migrations/0002_views_indexes.sql` (indexes, views, materialized views)
- Seed data for local/dev: `db/seed_dev.sql`

## Prerequisites

- Node.js and npm
- Supabase CLI (installed on-demand via `npx`)
- psql (for running the seed against a DATABASE_URL)

## Local workflow (Supabase CLI)

Initialize Supabase locally (one-time):

```bash
npx supabase init
```

Apply migrations to your local Supabase instance:

```bash
# Starts local containers and applies migrations
npx supabase db push
```

Reset local database (drops and re-applies migrations):

```bash
npx supabase db reset --local
```

Apply migrations to a remote database using a connection string:

```bash
# Use when you have a remote Postgres (e.g., Supabase project) URL
npx supabase db push --db-url "$DATABASE_URL"
```

## Seeding dev data

Run the seed script against any Postgres database via `psql`:

```bash
psql "$DATABASE_URL" -f db/seed_dev.sql
```

Where `DATABASE_URL` is your Postgres connection string (from Supabase Project Settings → Database).

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
cd supabase
supabase db reset   # drops + recreates schema, applies migrations in order
```

Apply to a remote project:
```bash
# Set project ref or run `supabase link`
supabase db push
```

Files:
- `supabase/migrations/0001_init.sql` — core schema, enums, constraints.
- `supabase/migrations/0002_views_indexes.sql` — indexes, materialized view, ranking/anonymity views, RLS scaffolding (commented).
- `db/seed_dev.sql` — optional dev seed data.

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

