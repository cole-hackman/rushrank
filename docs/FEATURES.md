# RushRank — what the app does

Written for a rush chair deciding whether to run their chapter's rush on this. Organized
by the order things happen in a real rush, not by screen.

---

## Before rush — building the interest list

**Interest form with a shareable link.** A public page a PNM can fill out himself: name,
contact, year, major, how he heard about you. Drop the link in the chapter Instagram bio.
Every submission lands in the pipeline, tagged with where it came from, so you can see at
the end of rush whether Instagram, referrals, or tabling actually produced the guys you
bid.

**Pipeline board.** A drag-and-drop board of everyone who has reached out but isn't yet a
rushee: *not contacted → reached out → responded → invited*. Each name can be assigned to
a specific brother so "somebody should DM him" becomes one person's job. Nobody sits in
"not contacted" for two weeks without it being obvious.

**Duplicate detection.** The same guy fills out the form twice with two email addresses,
or gets added by hand after he already signed up. RushRank flags likely duplicates and
merges them into one record — his notes, tags, votes, and event check-ins all move onto
the surviving profile instead of being split across two.

## Setting up — getting your list in

**CSV import.** Upload a spreadsheet or a registrar export. RushRank matches your column
headers automatically, shows you a preview of exactly what it's about to create, flags bad
rows and duplicates before anything is written, and lets you correct the column mapping if
it guessed wrong. Nothing is saved until you confirm.

**One-by-one entry**, with photo upload, for the guys who walk in.

**Custom questionnaires.** Define the questions your chapter actually asks. Answers are
attached to the PNM profile and visible during voting.

**Tags.** Legacy, athlete, referred by a brother, business major — whatever your chapter
sorts on. Tag stats show how each group is performing across rounds.

**GPA and academic eligibility.** Set your chapter's GPA minimum once. Every PNM shows as
eligible, below, or *not on file* — a transfer with no GPA yet is never rendered as
failing. Exceptions are a real process: a waiver requires a named brother and a written
reason, both recorded, so an exception is a decision instead of somebody quietly editing a
number.

## During rush — events and attendance

**Events with QR check-in.** Create the event, print or display the QR, guys check
themselves in. Attendance is per-PNM and per-event.

**Contact coverage — "who has actually met this guy."** One tap on a PNM's profile marks
that you've met him. Each PNM shows how many brothers have met him and whether *you* have.
This is the number that decides whether a vote is informed: when a guy gets cut after four
brothers met him, that's a data problem, not a judgment.

## Voting

**Live voting sessions.** The chair opens a session; brothers join on their phones. The
chair advances the chapter through PNMs one at a time and everyone votes on the same guy
at the same moment. Votes appear in real time over a websocket — no refreshing, no "did
everyone vote yet."

**Mobile swipe interface.** Built for a phone in a dark chapter room, not a laptop.

**Anonymous by design.** Brothers see the tally, not who voted which way.

**Locking.** The chair can lock voting on a PNM so late votes don't drift the result after
discussion has moved on.

**Rounds.** Multiple rounds per rush, each with its own PNM set, each independently
exportable.

## Deciding

**Results table** per round: yes percentage, favorite count, participation, and a
**controversy score** that surfaces the guys the chapter genuinely split on — the ones
worth discussing rather than the ones already decided.

**Round cutoffs.** Cut from the results screen: top N, or a minimum yes percentage. You
get a preview of exactly who advances and who doesn't before anything is committed. Ties
at the boundary are never split arbitrarily — everyone tied at the cutoff advances, and
the count tells you so. Confirming ends the round and opens the next one with the
advancing PNMs already loaded.

**Compare view.** Two or more PNMs side by side when the room is stuck.

**Analytics.** Voting patterns per brother — supportive, harsh, balanced, low
participation — plus attendance and capacity views across the rush.

## Bids

**Bid list** with buckets (bid / maybe / no) and a chapter-configurable cap.

**Bid outcomes.** Track offered → accepted / declined, with a reason on declines. The cap
counts *acceptances*, not offers, and shows remaining slots accordingly — so you know
whether you can extend three more bids tonight without going over.

**Locking** so two exec members can't edit the bid list simultaneously and overwrite each
other.

**Exports:** bid list as CSV or PDF.

## Throughout

**Roles.** Admin, exec, and member, each with a different level of access. Chapters invite
brothers by email.

**Multi-tenant.** Every chapter's data is isolated at the database level, not just hidden
in the UI. Chapters can set their own name, colors, and theme.

**Audit log.** Who created a round, who ran a cut, who imported the roster, who changed
somebody's role, who finalized the bid list — with timestamps, filterable by action type.
When somebody asks "who cut him?", there's an answer.

**Exports:** all PNMs, filtered PNMs, a comparison set, event attendance, per-round
results — CSV throughout. Plus PNM share cards as PNGs (1080×1350, sized for stories) and
a PowerPoint export for chapters that still present rush on a projector.

**Read-only demo mode.** A demo account can see a fully populated chapter and click
through everything without being able to change a thing. Useful for showing another
chapter what it looks like with real data in it.

---

## Status — read this before you show it to anyone

The feature list above is what exists in code. Three things sit between it and a chapter
using it in a live rush:

1. **Six of these features are on unmerged branches.** Pre-rush pipeline + interest form,
   contact coverage, bid outcomes, duplicate merge, GPA eligibility, and the frontend
   design pass are all built and tested but sitting in draft pull requests (#10–#15).
   Everything else in this document is on `main`.

2. **The database migrations have never been applied to a live database.** Migrations
   0013 and 0015–0018 exist, apply cleanly twice against a local Postgres 16, and roll
   back atomically on error — but no real Supabase instance has run them. This is the
   single blocking item for a demo, and it's a half-hour job, not a project.

3. **Two analytics buttons are stubs** — "Filter options" and "Report generation" both say
   *coming soon* in the UI. Everything else on that page is live.

Deliberately not built, and worth saying out loud when a chapter asks: new member
education, chapter-wide chat, and Instagram DM automation. The first two are a different
product; the third is against Instagram's terms and would get the chapter's account
banned.
