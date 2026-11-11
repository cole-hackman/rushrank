# RushRank for members

**For:** every brother in the chapter. This covers signing in, helping at events, getting to know PNMs and voting.

**Written 11 November 2026, updated the same day** after the fixes on this branch. Every step here was confirmed in the code. Things that currently do not work are listed separately under [Known problems](#known-problems).

RushRank works in your phone's browser. There is nothing to install.

## 1. Sign in for the first time

Your rush chair adds you by email. You may or may not get an invitation email, so use this route:

1. Open the RushRank **Sign in** page.
2. Type your email address.
3. Choose **Forgot password?** A reset email is sent to you.
4. Open the link in that email, enter a **New Password** (at least 6 characters), confirm it, and choose **Update Password**.
5. Sign in with your email and that password.

Do this before the first event or meeting, not in the room.

To change your password later: tap your initials, choose **Profile**, and use **Change Password**.

## 2. Find your way around

On a phone there is a bar along the bottom:

| Button | What it is for |
|---|---|
| **Home** | Today's event and shortcuts |
| **Rush** | Add a PNM or check PNMs in at an event |
| **PNMs** | The list of everyone rushing |
| **Voting** | Join a live voting session |
| **Events** | The event calendar |

The menu at the top also has **Pipeline**. On a laptop the same pages are along the top, plus **Results**.

## 3. At a rush event

### Check a PNM in

1. Tap **Rush**. Check that the right event is shown under **ACTIVE EVENT**.
2. Tap **Check In**.
3. Use **Manual List** to find the PNM by name and check them in. Or tap **Scan QR** and point the camera at the PNM's RushRank code if they have one.

### Add someone new

1. Tap **Rush**, then **Add PNM**.
2. Hand your phone to the PNM. They enter their details and take a photo.
3. When they submit, they are on the roster and checked in to today's event.

## 4. Get to know the PNMs

### After you talk to someone

1. Tap **PNMs** and find them. You can search by name.
2. Tap **I've met him**. It changes to **Met**. Tap again to undo.

This matters. It tells the rush chair which PNMs nobody has spoken to yet, and it tells you who to ask about someone you have not met.

### Leave a note

1. Open the PNM's page by tapping their name.
2. Under **Notes & Comments**, type in **Add a comment...**
3. Tick **Post anonymously** if you do not want your name shown to other brothers.
4. Tap **Post Comment**.

The PNM's page also shows **Who's met him** and which events they attended.

### Before rush: the pipeline

If you know someone who might rush, or someone has messaged the chapter:

1. Open **Pipeline** from the menu.
2. Find their card, or ask your rush chair for the interest link to send them.
3. Tap **I'll take this** to make them yours to follow up.
4. Drag their card along as things progress: New, Reached out, Talking, Invited.
5. When they are coming out to rush, tap **To rush →**.

**Mine** shows only the people you have claimed.

## 5. Voting

### Join

When the chair starts a session, tap **Voting**. You are put into the session automatically. If you see a **Join Session** box instead, type the six-character code the chair reads out and tap **Join Session**.

A small label shows **Live** when you are connected. **Polling** is fine too: your screen updates every few seconds instead of instantly.

### Vote

You see one PNM at a time: the one the chair has put up.

- Tap **Yes**, **No** or **Don't Know**.
- Or swipe the card: right for Yes, left for No, up for Don't Know.
- Tap the star to mark a favourite.

You will see "Voted YES", "Voted NO" or "Voted Don't Know". You can change your vote for as long as that PNM is on screen; your latest tap is the one that counts.

If you have not met the PNM, **Don't Know** is the honest vote.

### What the chair controls

- **Locked:** when the chair locks voting, your buttons grey out and you see "Voting is currently locked". Wait for the next PNM.
- **Next PNM:** the card changes on its own. You cannot go back.
- **End:** when the session finishes you are taken to the results.

## 6. What you can and cannot see

**You can see:**

- The results of every round: each PNM's Yes, No and Unknown counts and score.
- PNMs' contact details on the roster, with **Show email** and **Show phone**.
- Who has met each PNM.
- The pipeline.

**You cannot see:**

- How any other individual brother voted.
- The admin pages: settings, user management, bid list, activity log.

**Be aware:** admins can see a summary of each brother's voting, including how often you vote and how your votes compare with the chapter's.

---

## Known problems

| Problem | What to do |
|---|---|
| **You may not get an invitation email.** | Use **Forgot password?** as in step 1. |
| **Some buttons will not work for you** and show an error: Start Session, Add Event, Make cuts, Bulk Tag, and editing or deleting an event. They are for admins. | Ignore them. |
| **The "Open Voting" tab does not work for members.** You get "Failed to start open voting". | Vote in live sessions. |
| **If you star a PNM and then vote, the star is removed.** | Vote first, then tap the star. |
| **Tapping the star without voting counts as a "Don't Know" vote.** | Vote first, then star. |
| **The star still looks tappable when voting is locked,** then shows "Failed to favorite". | Wait for the next PNM. |
| **You cannot see how you already voted on the current PNM,** and the "Your Progress" counts reset if you reload the page. | If unsure, vote again. Your latest vote replaces the earlier one. |
| **A session marked "Anonymous" is not anonymous.** Your votes are stored against your account as usual. | Assume admins can see your voting pattern. |
| **The timer on your phone may not restart** when the chair moves to the next PNM. | Go by the chair. |
| **If your screen says "Polling" when the session ends, you are not taken to the results.** | Open Results yourself (on a laptop, or ask the chair for the link). |
| **There is no Results button on a phone.** | You are taken there after a session. Otherwise use a laptop. |
| **"Post anonymously" hides your name on screen only.** The note still carries your account id. | Do not write anything you would not sign. |
| **Changing your name on the Profile page does not stick,** and other brothers may see you as "A brother" or as your email address. | None today. |
| **On an event's check-in page, typing a name does not narrow the list.** | Check in from **Rush → Check In → Manual List** instead. |
| **Observers cannot vote, post notes or mark "met".** If every button gives an error, you have been set as an observer. | Ask your rush chair to make you a Member. |

---

## Where each step was confirmed

For whoever maintains this guide. Paths are in the RushRank repository.

| Section | Code |
|---|---|
| 1 Sign in | `frontend/app/login/page.tsx:87-118,203-309`; `frontend/app/(dashboard)/profile/page.tsx:209-246`; `python_server/services.py:2826-3127` |
| 2 Navigation | `frontend/components/BottomNav.tsx:17-23`; `frontend/app/(dashboard)/layout.tsx:108-114,145` |
| 3 Events | `frontend/app/(dashboard)/rush/page.tsx:125-200`; `frontend/components/rush/CheckInView.tsx:237-320`; `frontend/components/rush/AddPnmView.tsx` |
| 4 Met and notes | `frontend/components/pnm/MetButton.tsx:89`; `frontend/app/(dashboard)/pnms/[id]/page.tsx:374-396`; `python_server/routes.py:1190-1233,1576-1588`. Run by `e2e/flows.mjs` on 11 Nov 2026. |
| 4 Pipeline | `frontend/app/(dashboard)/pipeline/page.tsx:330,405-420` |
| 5 Voting | `frontend/app/(dashboard)/voting/page.tsx:62,199-208,487-495,533-540,620-633,918-951`; `python_server/routes.py:1712-1822`. Run with 24 voters by `e2e/ws-voting.mjs` on 11 Nov 2026. |
| 6 Visibility | `python_server/routes.py:1609-1634,1841-1852`; `frontend/components/AdminProtected.tsx` |
| Known problems | `docs/reboot-2026-11/02-unfinished-and-broken.md`, findings F4, F5, F10, F12, F13, F14, F24, F25, F31, F32, S12 |
