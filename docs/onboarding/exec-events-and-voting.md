# Running events and a voting session

**For:** the rush chair and rush committee: whoever creates events, runs check-in, chairs voting, makes cuts and builds the bid list.

**Written 11 November 2026, updated the same day** after the fixes on this branch. Every step here was confirmed in the code. Things that currently do not work are listed separately under [Known problems](#known-problems).

> **You need the Admin role for most of this guide.** RushRank has no working "exec" role today. Creating events, starting and chairing a voting session, making cuts, tagging and importing all require Admin. Ask your chapter's admin to set your role on **Admin → User Management**. Ordinary members can still check PNMs in, add PNMs at an event, post notes and vote.

## Part 1: Events

### Create an event

1. Go to **Events** and choose **Add Event**.
2. Enter an **Event Name** and a **Date**. These two are required. **Location**, **Start Time** and **Description** are optional.
3. Choose **Add Event**.

Each event in the list has these actions: **Open Check-in**, **View Details**, **Edit Event**, **Export Attendance** and **Delete Event**.

### Check PNMs in at the door

Any member can do this, on a phone.

**From the event:**

1. On **Events**, choose **View Details** on the event. This opens its check-in page.
2. Find the PNM in the list and choose **Check In**. A running count and a **Recent Check-Ins** list update as you go.
3. If the PNM has a RushRank QR code, tap **QR** to open the camera and scan it instead.

If someone is already checked in you will see "Already checked in".

**From Rush Mode:**

1. Go to **Rush**. Pick the event under **ACTIVE EVENT**; today's event is selected for you.
2. Choose **Check In**. Use **Manual List** to find someone by name, major, hometown or year, or **Scan QR**.

### Add a PNM who walks up

1. Go to **Rush**, make sure the right event is selected, and choose **Add PNM**.
2. Hand the phone to the PNM. They fill in their details and take a photo. A photo is required here.
3. When they submit, they are added to the roster and checked in to any event dated today.

## Part 2: Before rush, the pipeline

The **Pipeline** page tracks people you are talking to who are not rushing yet. Any member can use it.

- **Columns:** New, Reached out, Talking, Invited, No reply. Drag a card from one to the next as the conversation moves.
- **Claim someone:** choose **I'll take this** on a card. That prospect is now yours to follow up. Click your name on the card to hand them back.
- **Filters:** **Everyone**, **Mine**, and **Nobody's on it** (prospects no brother has claimed).
- **Move to rush:** when a prospect in Talking or Invited is coming out, choose **To rush →**. They become a PNM on the roster.
- **Where they come from:** a panel at the bottom shows how many prospects each source produced and how many reached rush.

Prospects arrive through the interest link; see the [admin setup guide](admin-setup.md#8-bring-in-your-pnms).

## Part 3: Getting to know PNMs

### The roster

**PNMs** lists everyone in formal rush. Use the search box and these switches: **Show email**, **Show phone**, **Show archived**, **Nobody's met**.

"Nobody's met" is the list to read out at a meeting: PNMs no brother has marked as met.

Tick rows to act on several at once:

- **Compare**: tick two to five PNMs to see them side by side.
- **Export CSV**: downloads exactly what the roster is showing, or only the ticked rows if any are ticked. Search and filter first to export a subset.
- Admins can also **Bulk Tag**, **Archive** and **Delete**. Each asks you to confirm first.
- **Export → PowerPoint** (admins only) builds a slide per PNM.

### A PNM's page

Click a name to open their page. Any member can:

- Choose **I've met him**. The **Who's met him** panel lists the brothers who have.
- Post a note under **Notes & Comments**. Tick **Post anonymously** to hide your name from other brothers.
- See which events the PNM attended, under **Attendance**.
- Choose **Export Image** to make a shareable card.

## Part 4: A live voting session

In a live session the chair shows one PNM at a time and every brother votes on that PNM from his own phone.

### Before the meeting

- Everyone who will vote needs to be able to sign in. Check this the day before, not in the room.
- Archive anyone who should not be voted on. A session includes **every PNM who is not archived and not a prospect**, in alphabetical order.
- Put the chair's screen on the projector if you want the room to see the count.

### Start the session

1. Go to **Voting**. The **Live Session** tab is selected.
2. Under **Start Session**, set **seconds per PNM** (180 by default; leave it empty for no timer; the minimum is 10).
3. Choose **Start Session**. You will see "Session started" and a six-character **Join Code**.

Starting a session ends any session that was already open.

### Get everyone in

Brothers open **Voting** on their phones. They are placed in the session automatically; no code is needed. If someone sees a **Join Session** box instead, they type the join code and choose **Join Session**.

Each screen shows **Live** when it is connected. **Polling** means that phone is checking for updates every few seconds instead; it still works, a little behind.

### Run it

For each PNM:

1. Brothers vote **Yes**, **No** or **Don't Know**, by tapping or by swiping (right for Yes, left for No, up for Don't Know). They can change their vote while the PNM is on screen.
2. Watch **Votes Collected**. It counts brothers who have voted so far in the session, out of everyone in the chapter.
3. To stop voting on this PNM, choose **Lock Voting**. Brothers' buttons grey out and late votes are refused. **Unlock Voting** reopens it.
4. Choose **Next PNM**. Every phone moves to the next person.

Any admin in the session has the chair controls, not only the person who started it.

**Someone added during the session** (a walk-up added in Rush Mode, a prospect moved to rush, an unarchived PNM, a CSV import) joins the end of the running order, so you reach them after everyone already queued.

### Finish

- After the last PNM, **Next PNM** ends the session.
- To stop early, choose **End Session** and confirm. Votes already cast are kept.

Either way, everyone is taken to the **Results** page for that round.

## Part 5: Results and cuts

### Read the results

**Results** shows one round at a time. Pick the round from the dropdown.

- Columns: Rank, PNM, Score, Yes, No, Unknown, Favorites, Status.
- Status: **Top Choice** (85% yes or more), **Strong** (70% or more), **Controversial** (40–60%), otherwise **Moderate**.
- Filters: search, **Favorites only**, and **Yes % ≥ 70%**.

Every member can see this page.

### Make cuts

1. On **Results**, choose **Make cuts**.
2. Pick **Advance top N** or **Cut below a %**, and set the number with the slider.
3. Optionally tick **Also archive the PNMs who are cut**. Do this if you want your next live session to include only the survivors.
4. Choose **Review**. You see exactly who advances and who is cut. If several PNMs are tied at the line, they all advance, and you are told.
5. Choose **Confirm cuts**. The round is closed and a new round is started with the PNMs who advanced.

Nothing is changed until you confirm. Cuts are recorded in the Activity Log.

## Part 6: The bid list

**Admin → Bid List.**

### Build it

1. The first time, choose the round to start from. Everyone from that round is placed in **Maybe**, ordered by score.
2. Choose **Start editing**. Only one person can edit at a time; your lock lasts 10 minutes and renews while you work.
3. Drag PNMs between **Bid**, **Maybe** and **Cut**.
4. **CSV** and **PDF** export the list at any point.
5. When the chapter has decided, choose **Finalize** and confirm. The list becomes read-only.

### Track answers

Each PNM in the **Bid** column has a dropdown: **Not sent**, **Offered**, **Accepted**, **Declined**. Set it as bids go out and answers come back. For Declined you are asked for an optional reason. You do not need to be in editing mode, and each change is recorded in the Activity Log.

## Part 7: Exports and analytics

**Export Center** (menu under your initials):

- **Export All PNMs**: a spreadsheet of the roster.
- **Export Event Attendance**: a spreadsheet for one event.
- **Export All PNM Images (ZIP)**: a card image per PNM.
- **Download .pptx**: a slide per PNM for the bid meeting. Admins only, up to 200 PNMs.
- **Export Filtered** and **Export Comparison**: reached from the roster. Filter the roster and use its **Export CSV**, or tick PNMs and use **Compare**.

**Admin → Analytics:**

- **Round Comparison**: how each PNM's score moved between rounds.
- **Voting Patterns** (admins only): each brother's participation and how his votes compare with the chapter's.
- **Attendance**.
- **Exports**: download a round's results as a spreadsheet.

---

## Known problems

### Roles

| Problem | What to do |
|---|---|
| **There is no usable exec role.** It cannot be assigned, and almost everything in this guide needs Admin. | Make the rush committee Admins. |
| **Members see buttons they cannot use:** Add Event, event edit and delete, Start Session, Make cuts, Bulk Tag. They get an error. | Tell members to ignore them. |

### Events and check-in

| Problem | What to do |
|---|---|
| **Searching on an event's check-in page does not narrow the list.** Typing a name still shows everyone, so the first **Check In** button is not the person you typed. | Scroll to the right name before tapping, or use **Rush → Check In → Manual List**, whose search does work. |
| **Rush Mode's Check In can open on the wrong event.** It picks the first event in the list, not the one you selected. | Check the event shown at the top of the check-in screen before you start. |
| **End Time and Capacity Limit are not saved.** | Put them in the description. |
| **Export Attendance on an event's row exports every event's attendance.** | Use **Export Center → Export Event Attendance** for one event. |
| **The dashboard's Create Event and New Event buttons open the Events page without the form.** | Choose **Add Event** on the page. |
| **PNMs cannot check themselves in.** There is no event QR to display, and the QR a PNM is emailed opens a page that does not exist if they scan it with their own camera. | A brother checks each PNM in, by name or by scanning the PNM's code with the in-app scanner. |
| **A PNM's QR code cannot be viewed inside RushRank.** It only reaches them by email, and only if email is configured for your installation. | Check in by name. |
| **The selected active event is remembered per phone,** not shared. | Each brother doing check-in selects the event himself. |

### PNM pages

| Problem | What to do |
|---|---|
| **A PNM's page cannot be edited.** No changing details, tags or photo from there. | Tag from the roster with Bulk Tag. Photos can only be added when the PNM is created in Rush Mode. |
| **"Yes Rate" always shows a dash and "Favorites" always shows 0** on a PNM's page. | Use the Results page. |
| **Anonymous notes are not fully anonymous.** Your name is hidden on screen, but the note still carries your account id to other brothers' browsers. | Do not treat a note as private. |
| **Brothers may appear as "A brother" or as an email address** in "Who's met him" and on notes. | None today. |

### Voting

| Problem | What to do |
|---|---|
| **"Anonymous votes" does nothing.** The box adds an "Anonymous" badge only. Votes are stored against each brother, and admins can still see each brother's voting pattern on Analytics. | Do not tell the chapter a session is anonymous. |
| **The timer does not do anything at zero,** and on brothers' phones it does not restart when you move to the next PNM. | Treat it as a guide for the chair. Lock by hand. |
| **A session always includes the whole active roster.** It ignores the new round created by a cut. | Tick "Also archive…" when you cut, or archive by hand first. |
| **You cannot see who has not voted,** only how many have. | Ask the room. |
| **You cannot go back to an earlier PNM.** | Start a new session if you must revote. |
| **A brother whose phone shows "Polling" is not sent to Results when the session ends.** His screen stays on the last PNM. | Tell him to open Results himself. |
| **The "Open Voting" tab does not work for members.** | Use live sessions only. |

### Results, cuts and bids

| Problem | What to do |
|---|---|
| **Export CSV on the Results page leads nowhere useful.** | Use **Analytics → Exports**. |
| **There is no link to Results on a phone.** | After a session you are taken there automatically; otherwise use a laptop. |
| **You cannot set a bid cap,** so "bids left" never shows on a list you create. | Track the cap yourselves. |
| **"Take over editing" fails** until the other person's lock is 10 minutes old, even though the banner offers it. | Ask them to stop editing, or wait. |
| **There is one bid list per chapter.** It cannot be reset or reopened once finalized. | Do not finalize until you are sure. |
| **The bid list spreadsheet has no outcome column.** | Read outcomes from the page. |

### Exports and analytics

| Problem | What to do |
|---|---|
| **"Export All PNMs" includes prospects and archived PNMs, with email and phone,** and any member can run it. | Be careful who you send it to. |
| **The PowerPoint includes prospects and leaves GPA blank.** | Delete the extra slides. |
| **Analytics shows a "+12% vs last round" badge that is not real,** and "Generate Report" and "Filter PNMs" do nothing. | Ignore them. |

---

## Where each step was confirmed

For whoever maintains this guide. Paths are in the RushRank repository.

| Part | Code |
|---|---|
| 1 Events | `frontend/app/(dashboard)/events/page.tsx:203-205,612-643,673-792`; `python_server/routes.py:1934-1974`. Event creation run by `e2e/flows.mjs` on 11 Nov 2026. |
| 1 Check-in | `frontend/app/(dashboard)/events/[id]/checkin/page.tsx`; `frontend/components/rush/CheckInView.tsx:237-320`; `python_server/routes.py:2013-2025`; `python_server/services.py:2291-2292` |
| 1 Add PNM | `frontend/app/(dashboard)/rush/page.tsx:125-200`; `frontend/components/rush/AddPnmView.tsx:114-115,228`; `python_server/services.py:1096-1124` |
| 2 Pipeline | `frontend/app/(dashboard)/pipeline/page.tsx:330,405-420`; `frontend/lib/api.ts:699-705`; `python_server/routes.py:1088-1136` |
| 3 Roster and PNM page | `frontend/app/(dashboard)/pnms/page.tsx`; `frontend/app/(dashboard)/pnms/[id]/page.tsx:374-396`; `frontend/components/pnm/MetButton.tsx:89`. Note and "met" run by `e2e/flows.mjs`. |
| 4 Live session | `frontend/app/(dashboard)/voting/page.tsx:593-720`; `python_server/routes.py:2484-2602,2769-2935`. Run with 24 voters by `e2e/ws-voting.mjs` on 11 Nov 2026. |
| 5 Results and cuts | `frontend/app/(dashboard)/results/page.tsx:382-616`; `python_server/routes.py:1854-1897`; `python_server/services.py:1935-2037`. Cut preview run by `e2e/flows.mjs`. |
| 6 Bid list | `frontend/app/(dashboard)/bid-list/page.tsx:408-436,472-515`; `python_server/bid_list.py:58-86`; `python_server/routes.py:574-602`. Outcome run by `e2e/flows.mjs`. |
| 7 Exports and analytics | `frontend/app/(dashboard)/exports/page.tsx`; `frontend/app/(dashboard)/analytics/page.tsx:443-446`; `python_server/routes.py:1451-1479,1609-1620` |
| Known problems | `docs/reboot-2026-11/02-unfinished-and-broken.md`, findings F4, F5, F6, F10, F12, F14, F15, F19–F22, F24, F27–F29, F31, F32, S12 |
