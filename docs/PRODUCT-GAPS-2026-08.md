# What's missing to make RushRank the whole rush tool

**August 2026.** Companion to `AUDIT-2026-08.md`, which was about what was *broken*.
This is about what was never there.

The audit's question was "can this be handed to a second fraternity?". This one's
question is different: **once a chapter has it, does anything else stay open in
another tab?** Today the answer is no, and the reasons are specific.

---

## The funnel, and where RushRank actually starts

A chapter's rush year runs roughly like this. Marked with what the product covers
after the phase 1–6 work.

| Stage | What chapters do | RushRank today |
|---|---|---|
| **1. Interest** | Summer DMs, activities fair, tabling, referrals from brothers, legacies, high-school connections | **Nothing** |
| **2. Events** | Smokers, sports night, chapter dinner, interview night | Covered — events, QR + search check-in |
| **3. Getting to know** | Brothers meet PNMs, take notes, form opinions | Partial — notes and tags exist; nothing tracks *who has met whom* |
| **4. Deliberation** | Live voting, swipe sessions, discussion | Covered — sessions, timer, anonymity, live tallies |
| **5. Cuts** | Advance top N, cut below a threshold | Covered |
| **6. Bids** | Build the list, hand out bids, chase acceptances | Half — the list is covered, the *outcome* is not |
| **7. After** | New member education, dues, initiation | Out of scope, deliberately |

**The product starts at stage 2.** Stages 2–5 are genuinely good now. But a chapter
spends two to three months in stage 1, and that entire period lives in an Instagram
inbox, a GroupMe, and someone's Notes app. That is the single biggest hole, and it is
the one you named.

---

## Tier 1 — build these

### 1. Pre-rush interest pipeline

**The problem.** A rising sophomore DMs the chapter Instagram in July. Right now that
conversation lives in an inbox one person has the password to, and by August nobody
remembers his name. Chapters lose real prospects to this every year — not because they
were cut, but because nobody wrote them down.

**What's missing, precisely.** `pnms` has no `source`, no `owner`, no `stage`, and no
`instagram_handle`. Every row is already a full PNM the moment it exists. There is no
way to represent "someone we're talking to".

**What already exists to build on.** `/intake?chapter=<uuid>` is a working public form
that needs no login (`GET /public/chapters/{id}` + `POST /public/chapters/{id}/intake`).
That is exactly the link you'd put in an Instagram bio — it just doesn't record where
the person came from or who's handling them.

**The shape.** Add `stage` to `pnms` rather than a separate `prospects` table:

- One identity from first DM to bid day. No conversion step that loses notes.
- Tags, notes, events and photos work on prospects on day one.
- "Convert to PNM" becomes a status change, not a data migration.

Fields: `stage` (`prospect → pnm → bid → pledged`), `source` (`instagram`, `referral`,
`tabling`, `interest_form`, `walk_up`, `import`, `manual`), `owner_user_id` (the brother
running that conversation), `contact_status` (`new → contacted → responded → invited →
no_response`), `instagram_handle`.

Then: a **pipeline board** (drag between stages), a **shareable link + QR for the
Instagram bio**, and **"my prospects"** so a brother sees only his own follow-ups.

The one that actually changes behaviour is the owner field. "Someone should message
him" is how prospects get lost; "Devin owes him a reply" is how they don't.

### 2. Who has actually met this guy

**The problem.** A chapter votes on 60 PNMs. Any given brother has genuinely spoken to
maybe 15. The rest he's voting on off a photo and a vibe — or abstaining, which drags
the yes-percentage around for reasons that have nothing to do with the PNM.

**The fix.** A one-tap "I talked to him" from the PNM card at an event. Then:
- A coverage count on every PNM: *3 brothers have met him.*
- A filter: **PNMs nobody has met** — the list the rush chair reads out on Thursday.
- On the voting card: *you haven't met him* as a nudge toward Unknown over No.

Cheap to build — it's one table and a count — and it makes stage 4 legitimate rather
than a popularity contest among the guys who happened to be at the same table.

### 3. Bid outcomes

The bid list finalizes and then the trail goes cold. Chapters need `pending → offered →
accepted → declined`, a declined-reason, and a count against the bid cap that reflects
*accepted*, not *offered*. Small, and it's the difference between a tool that runs rush
and a tool that runs rush up to the last day.

---

## Tier 2 — high value, each needs one decision first

### 4. Outreach

Chapters send "Sports Night, Thursday 7pm" to 80 PNMs by hand, or not at all.
`MAILERLITE_API_KEY` is already in the environment, so **email is buildable now** —
send to a filtered set, track opens, log it to `audit_log`. **SMS is what chapters
actually want** and needs a Twilio account and a budget decision. Recommendation: build
email against the existing MailerLite integration, leave an adapter seam for SMS.

### 5. Duplicate detection and merge

With Instagram + intake form + CSV + walk-ups, the same person lands three times.
`csv_import.py` already detects duplicates and refuses to double-insert — but there is
no way to *merge* the two rows that already exist, so notes and attendance stay split
across both. Needs a merge UI and a "same person?" review queue.

### 6. Academic eligibility

Most chapters have a GPA minimum and most campuses require the chapter to certify it.
There is no GPA field. Add `gpa` + a chapter-level minimum, a flag on the PNM card, and
a filter — plus an explicit "reviewed by exec" override, because the exception process
is real and should be recorded rather than done in a group chat.

---

## Tier 3 — worth doing, not next

- **Interview night scheduling.** Slots × rooms × brothers, PNMs assigned, printed run
  sheet. Real pain, but a big build.
- **Brother accountability.** Which brothers came to rush events and voted. Chapters
  have attendance requirements and currently track them on paper.
- **Conflict-of-interest recusal.** Roommate, little brother, ex's brother. Let a voter
  mark a recusal so it reads as *recused*, not as a missing vote.
- **Rush budget.** Per-event spend against a season budget.
- **Photo sprint.** A bulk "assign photos to names" screen. The most common practical
  failure in stage 4 is voting on a name with no face.

---

## What I'd deliberately not build

- **New member education, dues, initiation.** A different product with different users.
  Rush ends at bid acceptance.
- **A chapter-wide social feed / chat.** GroupMe has won. Integrate, don't compete.
- **Instagram DM automation.** Reading a chapter's DMs needs Meta app review, a business
  account, and access to conversations with people who never agreed to be in a database.
  The link-in-bio form gets ~90% of the value with none of that. Worth revisiting only
  if a chapter asks and understands the consent question.

---

## Order

1. **Pre-rush pipeline** — the missing front half of the funnel, and everything below
   reads better once PNMs carry a source and an owner.
2. **Contact coverage** — cheapest thing on this list with the largest effect on whether
   the voting numbers mean anything.
3. **Bid outcomes** — closes the funnel.
4. **Email outreach** — the integration is already provisioned.
5. **Merge + GPA** — both become urgent the moment intake has more than one source,
   which is exactly what (1) creates.
