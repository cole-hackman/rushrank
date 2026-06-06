# RushRank — Feature Backlog

Ideas captured for later. Each is a starting point, not a spec. When we pick one up, run it through `superpowers:brainstorming` to scope it.

## Rush workflow

- **Conflict-of-interest disclosure.** Brother marks "I know this PNM" before voting; their vote is flagged or weighted differently. Especially relevant for legacies.
- **Round-by-round cutoffs with quorum.** "Round 2 requires N votes from M actives to be valid" enforced server-side, with a visible quorum bar in the session UI.

## Live voting UX

- **Anonymous mode toggle per session.** Currently votes are attributable to a user. Some chapters want a secret-ballot mode (especially for final round).
- **Voter participation panel.** Chair sees in real time who has / hasn't voted. Surfaces stragglers before the chair advances the PNM.
- **"Discuss" pause.** Chair pauses a PNM, the dossier goes full-screen on the projector, the room talks, then chair resumes — alternative to advancing immediately.

## PNM dossier depth

- **Smart photo cropper.** Drop a phone photo, auto-detect face, crop 4:5. Photo quality is currently a lottery; the PPTX export shows it.
- **Social auto-fill.** Paste a LinkedIn or Instagram URL → auto-populate major/year/photo. Respect ToS, opt-in only.
- **Interview scheduling.** 1:1 coffee chats / smokers booked through the app with calendar links. Events exist but not slot-based scheduling.

## Communications

- **PNM-side status app.** Magic-link route at `/pnm/<code>` where a PNM checks their own status ("you're invited to round 2"); chapter sends bids through the app. Closes the loop vs. group texts.
- **Bulk SMS/email to a filtered PNM list.** Twilio + the existing filter UI. Replaces ad-hoc group texts.

## Analytics

- **Vote drift.** A PNM's score across rounds — who's rising, who's falling. Currently results per round are visible but not the trajectory.
- **Voter calibration.** "Brother X votes 'up' 90% of the time" — exec-only insight to spot rubber-stampers and outliers.

## Multi-chapter / growth (leverages Phase A theming)

- **Inter-chapter PNM sharing.** When a PNM is cut at one chapter, surface their dossier to other chapters on the same campus (with PNM consent). Network effect across IFC.
- **Alumni mentor matching.** Once a chapter is on RushRank, match new members to alumni in adjacent fields/cities.
