# Setting up your chapter on RushRank

**For:** the person creating the chapter's account, usually the rush chair or president. You will be the chapter's first admin.

**Time:** about 30 minutes, plus however long it takes to gather your PNM spreadsheet.

**Written 11 November 2026, updated the same day** after the fixes on this branch. Every step here was confirmed in the code. Steps that currently do not work are listed separately under [Known problems](#known-problems), so the main steps only describe things that work. Read that section before you start: two of its items affect your first ten minutes.

## Before you start

- Use a laptop for setup. Everything also works on a phone, but the admin pages are easier on a wide screen.
- Use one browser for the whole signup. The sign-in link must be opened in the same browser you signed up in.
- Have your brothers' email addresses ready, and a spreadsheet of PNMs if you have one.

## 1. Create the chapter

1. Go to the RushRank home page and choose **Get started**.
2. **Your chapter:** enter your **Fraternity**, your **School** and a **Chapter name**. The chapter name fills itself in as "Fraternity at School"; you can change it. Choose **Continue**.
3. **You:** enter **Your name** and **Email**, then choose **Send magic link**.
4. Open the email and click the sign-in link, **in the same browser**. If it does not arrive, choose **Resend**.
5. You see **Setting up your chapter** for a few seconds, then land on the dashboard with a welcome message. Your chapter exists and you are its admin.

If setup fails you see the reason, with **Try again** and **Change chapter details**. Your email is already confirmed, so trying again does not send another link.

## 2. Set a password straight away

Signup does not ask for a password, and you will need one the next time you sign in.

1. Open the menu under your initials (top right) and choose **Profile**.
2. Under **Change Password**, enter a **New Password** (at least 6 characters) and **Confirm New Password**, then choose **Update Password**.

From now on you sign in at the **Sign in** page with your email and this password.

## 3. Find your way around

- **Top bar:** Home, Rush, Pipeline, PNMs, Voting, Results, Events.
- **Admin menu** (admins only): Settings, Tag Management, User Management, Duplicates, Bid List, Activity Log, Analytics.
- **Menu under your initials:** Profile, Settings, Theme, Export Center, Log out.
- **On a phone:** a bar along the bottom with Home, Rush, PNMs, Voting and Events.

## 4. Set your chapter colours (optional)

1. **Admin → Settings**.
2. Under **Chapter Appearance**, choose **Use our chapter colors**. RushRank suggests a colour from your fraternity's name; you can type a different hex code (for example `#0033A0`).
3. Choose **Save**.

To go back, choose **Generic (cream & black)** and save.

## 5. Invite your brothers

1. **Admin → User Management**.
2. For one person: stay on **Single**, type their email in **Email to invite...** and choose **Invite**.
3. For many: switch to **Bulk**, paste one email per line, and choose **Invite All**.

Everyone is invited as a **Member**. Each invited brother gets an account with a generated password.

**Tell each brother how to get in.** Do not rely on the invitation email arriving (see [Known problems](#known-problems)). The dependable route is:

1. They go to the **Sign in** page.
2. They type their email, then choose **Forgot password?**
3. They follow the link in the reset email and choose a password.

Then point them to the [member guide](member-guide.md).

## 6. Give people the right role

On **User Management**, open the role control in a brother's row and pick one. You will see "Role updated".

| Role | What they can do |
|---|---|
| **Admin** | Everything: events, live voting sessions, cuts, bid list, tags, import, invites, roles. |
| **Member** | Browse PNMs, add PNMs in Rush Mode, check PNMs in, post notes, mark who they have met, work the pipeline, vote, see results. |
| **Observer** | Look only. An observer cannot vote, post notes or change anything. |

Whoever will create events and run voting sessions needs to be an **Admin**. See the [guide for running events and voting](exec-events-and-voting.md).

Role changes are recorded in the Activity Log.

## 6b. Add intake questions (optional)

Questions every PNM answers when they sign up, such as "Why this chapter?".

1. **Admin → Settings**, under **PNM Intake Form Questions**.
2. Enter the **Question Text**, pick a **Field Type** (Text, Textarea, Number or Email), tick **Required field** if it must be answered, and choose **Add Question**.
3. The trash icon removes a question. Answers already given to it are kept, labelled "(question removed)".

The questions appear on the intake form, on Rush Mode's Add PNM, and on the public `/intake?chapter=` link. A PNM's answers show on their page under **Intake answers**.

## 7. Create your tags

Tags are labels such as "Athlete" or "Legacy" that you can put on PNMs.

1. **Admin → Tag Management → Create Tag**.
2. Enter a **Tag Label**, pick a colour, and save.
3. Each tag can be edited, duplicated or deleted from its menu. Deleting a tag removes it from every PNM.

To put tags on PNMs: go to **PNMs**, tick the rows you want, choose **Bulk Tag**, and pick the tags.

## 8. Bring in your PNMs

You have three ways. Use whichever fits; they can be combined.

### Import a spreadsheet

1. **PNMs → Import CSV** (admins only).
2. Drop in a `.csv` file. Only a **name** column is required. Email, phone, major, year, hometown, photo link, GPA and tags are picked up if present. Limits: 2 MB and 2,000 rows.
3. You get a **preview** before anything is saved: rows read, how many will import, how many are already in RushRank, and any problems. Check the **Column mapping** and correct any column that was guessed wrong.
4. Choose **Import N PNMs**.

What the import skips, and tells you about: rows with an invalid email, rows repeated within the file, and people already on your roster (matched by email, or by name when the row has no email). Tags in the file are created if they do not exist; separate several with `;`, `,` or `|`.

### Share the interest link

For people who are not rushing yet: Instagram bio, tabling, referrals.

1. Go to **Pipeline**.
2. Under **Your interest link**, pick where you will post it (Instagram, Tabling, Brother referral or General) and choose **Copy**.
3. Post the link. Anyone who opens it sees a short form, **Interested in rush?**, and needs no account. They give a name and at least one of Instagram, email or phone.

Each person who fills it in appears on the **Pipeline** board as a prospect, marked with where they came from. Prospects are kept off the PNM roster and out of voting until a brother moves them **To rush**.

### Add people one at a time

**Rush → Add PNM** on a phone, handed to the PNM at an event. This is covered in the [events guide](exec-events-and-voting.md).

## 9. Clean up duplicates

Once names arrive from more than one place, the same person will appear twice.

1. **Admin → Duplicates**. Possible duplicates are grouped by same email, same phone or same name.
2. In a group, choose **Keep this one** on the record you want to keep.
3. Confirm. The other record's notes, attendance, votes and tags move to the one you kept. **This cannot be undone.**

## 10. Check the Activity Log

**Admin → Activity Log** shows who did what: rounds, cuts, imports, archives, deletions, merges, role changes and bid list changes. Filter with **Rounds**, **PNMs**, **Roles** or **Bid list**.

## 11. You are ready when

- [ ] You can sign in with your email and a password.
- [ ] Your brothers are listed on User Management and at least a few have signed in.
- [ ] Anyone who will run events or voting is an Admin.
- [ ] Your PNMs are on the **PNMs** page, with no obvious duplicates.
- [ ] Your interest link is posted, if you are recruiting before rush.

Next: [running events and a voting session](exec-events-and-voting.md).

---

## Known problems

These do not work as you would expect today. Each has a workaround where one exists.

### Signing up and signing in

| Problem | What to do |
|---|---|
| **Signup never asks for a password.** If you log out before setting one, you cannot get back in with the Sign in form. | Do step 2 immediately. If you are already locked out, use **Forgot password?** on the Sign in page. |
| **The sign-in link only works in the browser you signed up in.** Opened anywhere else, it signs you in and then tells you it cannot finish there. | Open the link in the browser you started in, or choose **Enter details here** and sign up again in that browser. |
| **Two chapters cannot have the same chapter name.** If the name is taken, signup stops and says so. | Choose **Change chapter details** and add your school or city to the name. |

### Inviting brothers

| Problem | What to do |
|---|---|
| **"Invitation sent" appears even when no email was sent.** Invitation emails depend on a separate email service being configured for your RushRank installation. | Tell brothers to use **Forgot password?**, as in step 5. |
| **Inviting someone who already has a RushRank account resets their password.** | Do not re-invite people who can already sign in. |
| **Re-inviting an existing admin turns them into a member.** | If it happens, set their role back to Admin on User Management. |
| **There is no "exec" role to pick,** although some screens mention one. | Make your rush committee Admins. |
| **You cannot remove someone from the chapter.** | Set them to **Observer**. |
| **Nothing stops you demoting the last admin, including yourself.** | Keep at least two admins. |
| **A brother who belongs to two chapters may land in the wrong one.** | Avoid inviting an email that is already in another chapter. |

### Settings

| Problem | What to do |
|---|---|
| **There is no place to set a GPA minimum,** enter a GPA by hand, or record a waiver. | GPA can only come in through a CSV import column. Track eligibility outside RushRank for now. |
| The welcome message says "Invite your team from Settings". | Invites are on **User Management**. |

### Importing and intake

| Problem | What to do |
|---|---|
| **In the import preview, a GPA column shows as "Ignore this column".** | It is imported anyway. Leave it. |
| **The full intake form has no shareable link in the app,** and when opened by someone who is not signed in, its photo upload fails. | Build the link yourself: your site address, then `/intake?chapter=` and your chapter id (the id is in your interest link). Or use Rush Mode's Add PNM at events. |
| **Imported PNMs are not emailed a check-in QR code.** | Check them in by name at events. |
| **The public forms do not check for duplicates.** Submitting twice creates two records. | Merge them on the Duplicates page. |

### Tags

| Problem | What to do |
|---|---|
| On Tag Management, **Apply to Selected**, each tag's **Apply** button and **Filter** do nothing useful. | Tag from the **PNMs** page with **Bulk Tag**. |
| **Bulk Tag is shown to members,** but only admins can use it. | Have an admin do the tagging. |

---

## Where each step was confirmed

For whoever maintains this guide. Paths are in the RushRank repository.

| Section | Code |
|---|---|
| 1 Create the chapter | `frontend/components/marketing/SignupWizard.tsx:66-79,113-118,139-226`; `python_server/routes.py:428-440`; `python_server/services.py:255-304` |
| 2 Password | `frontend/app/(dashboard)/profile/page.tsx:100-125,209-246`; `frontend/app/login/page.tsx:87-118,203-259` |
| 3 Navigation | `frontend/app/(dashboard)/layout.tsx:108-126,145-281`; `frontend/components/BottomNav.tsx:17-23` |
| 4 Colours | `frontend/components/settings/ChapterAppearanceCard.tsx:23-78`; `python_server/services.py:187` |
| 5 Invites | `frontend/app/(dashboard)/admin/users/page.tsx:115,145,224-286`; `python_server/services.py:2826-3127` |
| 6 Roles | `frontend/components/admin/UserRoleEditor.tsx:11,57`; `python_server/routes.py:335-379`; `python_server/auth.py:198-264` |
| 7 Tags | `frontend/app/(dashboard)/admin/tags/page.tsx`; `frontend/components/admin/TagForm.tsx`; `frontend/app/(dashboard)/pnms/page.tsx:385-391` |
| 8 Import | `frontend/app/(dashboard)/pnms/import/page.tsx`; `python_server/csv_import.py:36-37,47-84,158-270,308-335`. Run end to end by `e2e/flows.mjs` on 11 Nov 2026. |
| 8 Interest link | `frontend/app/(dashboard)/pipeline/page.tsx:429-483`; `frontend/app/interest/page.tsx:56-204`; `python_server/routes.py:675-716`. Run end to end by `e2e/flows.mjs`. |
| 9 Duplicates | `frontend/app/(dashboard)/admin/duplicates/page.tsx:42-124,214`; `python_server/routes.py:898-936` |
| 10 Activity Log | `frontend/app/(dashboard)/admin/audit/page.tsx:37-41,121-173`; `python_server/routes.py:1900-1919` |
| Known problems | `docs/reboot-2026-11/02-unfinished-and-broken.md`, findings F1, F6, F8, F9, F11, F25, F26, F30, F33, S15 |
