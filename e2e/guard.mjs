/**
 * Database guard for every e2e script that writes or deletes.
 *
 * Production holds real member data, and e2e/seed.py TRUNCATEs eighteen
 * tables on whatever database it is handed. This module refuses to continue
 * unless the target is provably a local, disposable database:
 *
 *   1. E2E_DATABASE_URL must be set explicitly. DATABASE_URL is never used as
 *      a fallback, because that is the variable the real backend reads.
 *   2. The host must be localhost / 127.0.0.1 / ::1 (or a unix socket).
 *   3. The database name must end in `_e2e` or `_test`.
 *   4. The URL must not mention supabase, render, pooler, neon or amazonaws.
 *   5. The server itself must agree: `select current_database()` has to return
 *      the same name, and inet_server_addr() has to be loopback or null.
 *   6. Any chapter already in the database must be the seed chapter (or a
 *      leftover "E2E Temp ..." chapter from api-contract.mjs). A database
 *      holding some other chapter is not ours to wipe.
 *   7. (assertBackendMatches) The running API must be serving that same
 *      database: the chapter id the API returns for the seeded admin has to
 *      equal the chapter id psql reads locally. Chapter ids are random UUIDs
 *      minted by the seed, so a backend pointed anywhere else cannot match.
 *
 * Run it on its own to see what would be targeted:
 *
 *   node guard.mjs            # database checks only
 *   node guard.mjs --api      # also check the running backend (needs fixtures.json)
 *
 * Exit code 0 means safe; anything else means stop.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const SEED_CHAPTER_NAME = "Beta Theta Pi - Cal Poly SLO";
// A second, small chapter the seed creates so cross-chapter access can be tested.
export const OTHER_CHAPTER_NAME = "Sigma Nu - E2E Other Campus";
// api-contract.mjs creates and immediately deletes chapters with this prefix.
export const TEMP_CHAPTER_PREFIX = "E2E Temp ";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);
const FORBIDDEN = /supabase|render\.com|onrender|pooler|neon\.tech|amazonaws|rds\.|azure|gcp|cloud/i;
const NAME_OK = /(_e2e|_test)$/;

export const API = process.env.E2E_API_URL || "http://localhost:8000";

function fail(reason) {
  console.error(`\nGUARD REFUSED: ${reason}`);
  console.error("Nothing was written. Fix the environment and run again.\n");
  process.exit(2);
}

/** Parse and vet E2E_DATABASE_URL without connecting. */
export function vetUrl() {
  const raw = process.env.E2E_DATABASE_URL;
  if (!raw) {
    fail(
      "E2E_DATABASE_URL is not set. This guard never falls back to DATABASE_URL. " +
        "Export E2E_DATABASE_URL=postgresql://<you>@localhost:5432/rushrank_e2e"
    );
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    fail(`E2E_DATABASE_URL is not a URL: ${raw.replace(/:[^:@/]*@/, ":***@")}`);
  }
  const host = u.hostname;
  const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const shown = `${u.protocol}//${u.username || "?"}@${host || "(socket)"}:${u.port || 5432}/${name}`;

  if (FORBIDDEN.test(raw)) fail(`the URL looks like a hosted database: ${shown}`);
  if (!LOCAL_HOSTS.has(host)) fail(`host "${host}" is not local: ${shown}`);
  if (!NAME_OK.test(name)) fail(`database name "${name}" does not end in _e2e or _test: ${shown}`);

  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== raw) {
    fail(
      "DATABASE_URL is set to something different from E2E_DATABASE_URL. " +
        "seed.py and fixtures.py would be safe, but a backend started from this shell would not be. " +
        "Run `set -a && . ./e2e/env.sh && set +a` (or unset DATABASE_URL) first."
    );
  }
  return { raw, host, name, shown };
}

/** Run one query through psql against E2E_DATABASE_URL (and nothing else). */
export function sql(query) {
  const { raw } = vetUrl();
  const out = execFileSync("psql", [raw, "-X", "-v", "ON_ERROR_STOP=1", "-tAF", "|", "-c", query], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `/opt/homebrew/opt/libpq@17/bin:/opt/homebrew/opt/libpq/bin:${process.env.PATH}`,
    },
  });
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("|"));
}

/**
 * Checks 1-6. Returns what was verified so the caller can print it.
 * `allowEmpty` lets the pre-seed call pass on a freshly migrated database.
 */
export function assertDisposableDb({ allowEmpty = true, quiet = false } = {}) {
  const { name, shown } = vetUrl();

  let row;
  try {
    [row] = sql("select current_database(), coalesce(host(inet_server_addr()), 'socket'), current_user");
  } catch (e) {
    fail(`could not connect with psql to ${shown}: ${String(e.message || e).split("\n")[0]}`);
  }
  const [serverDb, serverAddr, serverUser] = row;
  if (serverDb !== name) fail(`server reports database "${serverDb}", URL says "${name}"`);
  if (!["socket", "127.0.0.1", "::1"].includes(serverAddr)) {
    fail(`server address ${serverAddr} is not loopback`);
  }

  let chapters = [];
  try {
    chapters = sql("select id::text, name from chapters order by name");
  } catch {
    fail(`database "${name}" has no chapters table. Apply supabase/migrations/*.sql to it first.`);
  }
  const foreign = chapters.filter(([, n]) => n !== SEED_CHAPTER_NAME && n !== OTHER_CHAPTER_NAME && !n.startsWith(TEMP_CHAPTER_PREFIX));
  if (foreign.length) {
    fail(
      `database "${name}" contains ${foreign.length} chapter(s) that the seed did not create ` +
        `(first: "${foreign[0][1]}"). Refusing to touch a database with someone else's data in it.`
    );
  }
  if (!allowEmpty && chapters.length === 0) {
    fail(`database "${name}" has no seed chapter. Run: python3 e2e/guard.py --seed`);
  }

  const info = { database: serverDb, address: serverAddr, user: serverUser, chapters: chapters.length, shown };
  if (!quiet) {
    console.log(
      `guard: database OK -> ${shown} (server says db=${serverDb}, addr=${serverAddr}, user=${serverUser}, ` +
        `seed chapters=${chapters.length})`
    );
  }
  return info;
}

/** Check 7: the running API serves the same database psql just looked at. */
export async function assertBackendMatches({ quiet = false } = {}) {
  const fxPath = join(HERE, "fixtures.json");
  if (!existsSync(fxPath)) fail("e2e/fixtures.json is missing. Run: python3 e2e/guard.py --seed");
  const fx = JSON.parse(readFileSync(fxPath, "utf8"));
  const admin = fx.users.find((u) => u.role === "admin");

  const apiHost = new URL(API).hostname;
  if (!LOCAL_HOSTS.has(apiHost)) fail(`E2E_API_URL host "${apiHost}" is not local`);

  const [[dbChapter] = []] = sql(`select id::text from chapters where name = '${SEED_CHAPTER_NAME}' limit 1`);
  if (!dbChapter) fail("the seed chapter is not in the database. Run: python3 e2e/guard.py --seed");
  if (dbChapter !== fx.chapter.id) {
    fail("fixtures.json is stale (chapter id differs from the database). Run: python3 e2e/guard.py --seed");
  }

  let res;
  try {
    res = await fetch(`${API}/api/v1/chapters`, { headers: { Authorization: `Bearer ${admin.token}` } });
  } catch (e) {
    fail(`backend not reachable at ${API}: ${e.message}`);
  }
  if (res.status === 401) {
    fail(
      "the backend rejected the fixture token (401). Either the token expired (tokens last 12h; re-run " +
        "`python3 e2e/guard.py --seed`) or the backend was not started with e2e/env.sh's SUPABASE_JWT_SECRET, " +
        "which means it is not the e2e backend."
    );
  }
  if (!res.ok) fail(`GET ${API}/api/v1/chapters returned ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.chapters || body.data || [];
  const ids = list.map((c) => c.id || c.chapter_id);
  if (!ids.includes(dbChapter)) {
    fail(
      `the backend at ${API} is NOT serving the e2e database. It returned chapter(s) [${ids.join(", ") || "none"}] ` +
        `but the local database's seed chapter is ${dbChapter}. Stop that backend and start one from a shell ` +
        "that has sourced e2e/env.sh."
    );
  }
  if (!quiet) console.log(`guard: backend OK  -> ${API} serves seed chapter ${dbChapter}`);
  return { api: API, chapterId: dbChapter };
}

/** What every writing script calls first. */
export async function guard() {
  const db = assertDisposableDb({ allowEmpty: false });
  const be = await assertBackendMatches();
  return { ...db, ...be };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assertDisposableDb({ allowEmpty: true });
  if (process.argv.includes("--api")) await assertBackendMatches();
  console.log("guard: safe to proceed.");
}
