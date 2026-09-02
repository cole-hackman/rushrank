# Environment for the local end-to-end stack. Source it, do not commit it.
#
# Deliberately isolated from the real project: its own database, its own JWT
# secret, and a Supabase URL that is well-formed but points nowhere. The
# frontend only needs the Supabase client to be non-null so that
# lib/auth.ts reads a session out of storage; no request ever leaves the
# machine. Nothing here touches the production project.

export E2E_DATABASE_URL="postgresql://coleh@localhost:5432/rushrank_e2e"
export DATABASE_URL="$E2E_DATABASE_URL"

# Backend verifies HS256 against this (python_server/auth.py::verify_token),
# which is what lets the harness mint a token per brother without Supabase.
export SUPABASE_JWT_SECRET="e2e-local-testing-secret-do-not-use-anywhere-else"

export SUPABASE_URL="https://e2e-local.supabase.co"
export SUPABASE_ANON_KEY="e2e-local-anon"
export SUPABASE_SERVICE_ROLE_KEY="e2e-local-service-role"
export ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export PORT=8000

# Keep the limiter out of the way of the crawler, which fires far faster than
# a human. The multi-browser voting test re-tightens this on purpose.
export RATE_LIMIT_DEFAULT="10000/minute"
export RATE_LIMIT_WRITE="10000/minute"
export RATE_LIMIT_VOTES="10000/minute"
export RATE_LIMIT_AUTH="10000/minute"
