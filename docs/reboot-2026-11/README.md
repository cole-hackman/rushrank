# RushRank reboot assessment, November 2026

**Written 11 November 2026 against `main` at `bd82ecc`,** two months after the last commit (2 Sep 2026). It builds on `docs/AUDIT-2026-08.md`, `docs/PRODUCT-GAPS-2026-08.md` and `e2e/FINDINGS.md`, and re-checks every claim in them against the current code.

The assessment itself changed no application code. It added documents here and in `docs/onboarding/`, and new test scripts in `e2e/`.

**Follow-up on the same branch:** 25 of the 37 items the August audit left open were then fixed in the application, and the keep-warm item was improved as far as code can take it (see the update at the top of [`02-unfinished-and-broken.md`](02-unfinished-and-broken.md)). The four points below are unaffected; none of those fixes touched security, row-level security or the broken features listed in point 4.

## Where things stand

The August blockers are fixed. Signup, token refresh, results, the bid list and the admin pages all work, and a live voting session with 24 concurrent voters behaves correctly. RushRank now covers the whole funnel from first contact to bid outcome.

Four things need attention before feature work resumes:

1. **Production did not answer.** Three health checks timed out on 11 Nov. Both GitHub workflows (CI and keep-warm) have been disabled since early 2026.
2. **Any signed-up user can reset any other user's password.** Two unused admin endpoints check only that the caller is an admin of some chapter, and signup makes everyone an admin of their own.
3. **Row-level security is claimed but appears in no migration.** Whether production tables are readable with the public key has to be checked in the Supabase dashboard.
4. **Several features on the screen do not work:** saving intake questions (returns 500), Open Voting for members, anonymous voting (changes nothing), the exec role (cannot be assigned), GPA eligibility (no UI).

## Read in this order

| # | Document | What it answers |
|---|---|---|
| 7 | [`07-proposals.md`](07-proposals.md) | What to do first. Start here if you have ten minutes. |
| 2 | [`02-unfinished-and-broken.md`](02-unfinished-and-broken.md) | Every August audit and e2e finding marked fixed, still open or changed, with file and line; plus 18 security and 34 functional findings that are new. |
| 6 | [`06-test-plan.md`](06-test-plan.md) | Inventory of all 26 pages and 104 endpoints with their test coverage, and the runbook for your Mac. |
| 1 | [`01-tech-stack.md`](01-tech-stack.md) | Where the latency is, what was measured and what was inferred, and 20 improvements ranked by impact against effort. |
| 3 | [`03-features.md`](03-features.md) | 17 enhancements and 10 additions, ranked, each with why it matters to a chapter. |
| 4 | [`04-competitors.md`](04-competitors.md) | 11 products, with prices sourced and dated, and where RushRank can stand out. |
| 5 | [`../onboarding/`](../onboarding/) | Guides for the [admin](../onboarding/admin-setup.md), for [whoever runs events and voting](../onboarding/exec-events-and-voting.md), and for [members](../onboarding/member-guide.md). Each lists what is currently broken, separately from the steps. |

## New test scripts

In `e2e/`. See [`06-test-plan.md`](06-test-plan.md) for what each covers and how to run it.

| Script | Purpose |
|---|---|
| `guard.mjs`, `guard.py` | Refuse to run against anything but a local, disposable database |
| `ws-voting.mjs` | A chair plus concurrent voters, with all four websocket events asserted |
| `api-contract.mjs` | Every endpoint, signed out, as member and as admin |
| `roles.mjs` | Every page in four roles |
| `flows.mjs` | Eight real user flows, verified in the database |

**These have been run once, in a Linux container against a local Postgres, on 11 Nov 2026. They have not been run on macOS or on your machine.** All passed there, and they confirmed 21 of the findings in document 2 at runtime. Treat your first run as their real test.

## How claims are labelled

- **Measured** or **confirmed at runtime:** something was run and produced the result, on a local stack on 11 Nov 2026.
- **Inferred** or **code read:** concluded from reading the code or configuration; not executed.
- **Suspected:** the code suggests it; nothing proved it.
- **Not checked:** stated where it applies. The main ones: no production latency was measured; production's database, Supabase settings, Vercel settings and MailerLite automations were not inspected; nothing was run against production except three read-only requests to `/health`.

## What this assessment did not do

- Fix anything. Every fix is described, none is made.
- Run any test against production or any hosted database.
- Run the existing `crawl.mjs`, `destructive.mjs`, `visual.mjs` or `verify-changes.mjs`.
- Read the two local-only files mentioned in the brief (`CAPACITY_PLAYBOOK.md`, `.audit/`); they are not in the repository.
