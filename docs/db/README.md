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

