# Feature assessment

**Checked 11 November 2026 against `main` at `bd82ecc`.**

## Verdict

RushRank covers the whole funnel from first contact to bid outcome, which no single competitor does. The next work should not be new surface area. It should be, in this order:

1. **Make what is already advertised true.** Anonymous voting, Open Voting for members, the exec role, GPA eligibility and intake questions are all on the screen and do not work.
2. **Deepen the live session,** which is the reason a chapter would choose RushRank.
3. **Add the two things competitors have and RushRank lacks:** messaging PNMs, and PNM self check-in.

Effort is working time for one person who knows the code: **S** under a day, **M** one to three days, **L** a week or more. File and line evidence for every defect named here is in `02-unfinished-and-broken.md` (finding numbers in brackets).

## What exists today

| Stage of rush | Feature | State |
|---|---|---|
| Before rush | Public interest form with source tracking | Works |
| | Pipeline board with owners | Works |
| | CSV import with preview | Works; GPA missing from the mapping menu [F9] |
| | Duplicate detection and merge | Works (admin) |
| Events | Create and edit events | Works; end time and capacity are discarded [F19] |
| | Check-in by search or by scanning a PNM's QR | Search lists everyone [F10]; PNMs cannot check themselves in [F21] |
| | Rush Mode (add a PNM on a phone, check in) | Works; ignores the selected event [F20] |
| Getting to know | Notes, tags, "I've met him" | Works; anonymous notes leak the author id [S12] |
| | Intake questions | Broken: cannot be saved [F1, F2, F3] |
| | GPA eligibility | Backend only, no UI [F8] |
| Deliberation | Live session: advance, lock, live count, end | Works with 24 concurrent voters |
| | Timer | Display only [F12] |
| | Anonymous votes | Does nothing [F5] |
| | Open (asynchronous) voting | Broken for members [F4] |
| Cuts | Results, cut preview, next round | Works (admin); a live session ignores the next round [F15] |
| Bids | Bid board, edit lock, finalize, CSV and PDF | Works; no way to set a cap [F27] |
| | Offered / accepted / declined | Works |
| Admin | Roles | Admin, member and observer only; exec cannot be assigned [F6] |
| | Invites | Depend on an external MailerLite automation [F25] |
| | Theme, audit log, analytics, exports | Work, with gaps [F28, F29] |

## Enhance: current features, ranked

| Rank | Enhancement | Why it matters to a chapter running rush | Effort |
|---|---|---|---|
| 1 | **Make anonymous voting real, or remove the checkbox** [F5] | Brothers vote differently when they think it is private. Telling them it is anonymous while the admin page lists every brother's votes is a trust problem the first time someone notices. | M |
| 2 | **Fix intake questions end to end** [F1, F2, F3]: save the questionnaire, save the answers, show them on the PNM page | Every chapter has its own three questions. Right now the builder errors and the answers a PNM types are thrown away. | S |
| 3 | **Fix Open Voting for members** [F4] | It is the way to collect votes from brothers who cannot make the meeting. Today only an admin can use it. | S |
| 4 | **Make exec a real role** [F6, F7]: assignable, with a menu, and decide what it may do | Most chapters have a rush chair and two or three committee members who run events but should not manage accounts. Today they all have to be full admins. | M |
| 5 | **Fix check-in search** [F10] | At the door with a queue, typing a name and tapping the first result checks in the wrong person. | S |
| 6 | **GPA eligibility UI** [F8, F9]: set the minimum, enter a GPA, grant a waiver | Many campuses require the chapter to certify grades. The rules and audit trail exist; nobody can reach them. | M |
| 7 | **Live session: show who has not voted, and make the timer lock at zero** [F12] | The chair's real question is "who are we waiting on?". A timer that only counts down does not move the room along. | M |
| 8 | **Run a session on a chosen round, not always the whole roster** [F15, F16] | After cuts, round two should be the survivors. Today the admin has to archive everyone who was cut to get that. | M |
| 9 | **PNM page: edit, replace photo, manage tags, show real vote stats** [F22, F23] | The dossier is where brothers look before they vote. It cannot be corrected, and its two vote stats are always blank. | M |
| 10 | **Bid list: set the cap, working take-over, outcome in the export** [F27] | The cap is the number the whole bid meeting is argued against. | S |
| 11 | **Invites that tell the truth** [F25, F26]: show the admin a sign-in link, report when no email went out, stop logging passwords, never demote on re-invite, give the founder a password step | Getting 60 brothers signed in is the first hour of adoption. If the email silently does not arrive, it stalls there. | M |
| 12 | **Hide buttons a member cannot use** [F31] and add Results to the phone menu [F32] | A member tapping "Start Session" and getting an error reads as a broken app. | S |
| 13 | **Profile names that stick** [F24] | "A brother met him" is useless; the point of coverage is knowing who to ask. | S |
| 14 | **Exports that match their labels** [F28] | A "filtered" export that includes everyone, or a roster export with prospects' phone numbers, gets sent to the wrong people. | S |
| 15 | **Events: store end time and capacity; fix the per-event export and the Create Event link** [F19] | Small, but these are the first things an exec does on day one. | S |
| 16 | **Favourite without side effects** [F13] | A star that vanishes when you vote, or that counts as an "unknown" vote, skews the numbers the room is deciding on. | S |
| 17 | **Chapter switcher** | Only matters for someone in two chapters, which today is mostly you. | M |

## Add: new features, ranked

| Rank | Feature | Why it matters to a chapter running rush | Effort | Competitors that have it |
|---|---|---|---|---|
| 1 | **Message PNMs**: an event reminder to a filtered list, by email first, with SMS behind the same interface | "Sports night, Thursday 7pm" to 80 people is sent by hand today, or not at all. It is the most common feature RushRank lacks. | M for email, L with SMS | GreekPad, CampusRush, ChapterBuilder, RushPilot |
| 2 | **PNM self check-in**: an event QR on a poster or a screen that opens a "check me in" page | At a 150-person event, one brother with a scanner is the bottleneck. | M | GreekPad, RushBoard, PNMPulse |
| 3 | **Projector view for the live session**: full-screen photo, name and running count, no controls | The room looks at the wall, not at phones. It is also the best possible demo. | S–M | GreekPad |
| 4 | **Bid-day tracker**: who is calling whom, called / reached / answered | Bid day is a phone tree run from a group chat. Outcomes already exist; this is the step before them. | M | RushBoard |
| 5 | **Install to home screen, and offline check-in** | Rush events happen in basements. A check-in that fails without signal sends people back to paper. | M–L | Rush+, Greek Connect (native apps) |
| 6 | **Recusal**: a voter marks a conflict so it reads as recused, not missing | Roommates and family come up every cycle, and a missing vote drags percentages around. | S | none seen |
| 7 | **Brother participation**: who attended which rush events and who voted | Chapters have rush attendance requirements and track them on paper. The data is already in the database. | M | none seen |
| 8 | **Photo sprint**: a screen to assign photos to names in bulk | Voting on a name with no face is the most common practical failure in deliberation. | M | none seen |
| 9 | **Interview-night scheduling**: slots, rooms, brothers, a printable run sheet | A real pain point, but a large build. | L | PNMPulse (PNM calendar) |
| 10 | **A seeded public demo that shows everything** | The demo account today is an observer and is blocked from the bid list and admin pages. A prospect cannot see the best parts. | S | — |

## Not recommended

- **New member education, dues, initiation.** A different product. Rush ends at bid acceptance.
- **Chapter chat.** Group chat apps have won; link out to them.
- **Reading a chapter's Instagram messages or building profiles from handles.** It needs platform review and access to conversations with people who did not agree to be in a database. The link-in-bio form gets most of the value.
- **Weighted votes.** The column exists, but it changes the politics of a vote in ways most chapters will not want. Wait for a chapter to ask.

## Suggested order of work

1. The security fixes in `02-unfinished-and-broken.md` section 1. They come before any feature.
2. Enhancements 1 to 6. All are things the product already claims to do.
3. Add 3 (projector view) and enhancement 7 (who has not voted). Together they finish the live session.
4. Add 1 (messaging) and Add 2 (self check-in). These close the gap with competitors.
5. Everything else, as chapters ask.
