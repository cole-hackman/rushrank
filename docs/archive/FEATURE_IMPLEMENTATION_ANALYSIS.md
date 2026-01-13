# Feature Implementation Analysis for Cal Poly Pilot

## Current State Assessment

### Already Implemented (Partial/Full)
- ✅ Round configuration UI (basic - anonymous, swipe mode, timer, exec weight)
- ✅ Tag management backend (full API, no UI)
- ✅ Questionnaire backend (schema, API endpoints, no builder UI)
- ✅ Events/attendance (basic, QR is stub)
- ✅ CSV exports (basic)
- ✅ Mobile intake form (basic, no crop/preview)
- ✅ Voting system (swipe + buttons, dual modes)
- ✅ Results page (basic stats, no round comparison)

### Missing Completely
- ❌ User/brother management UI
- ❌ Custom questionnaire builder UI
- ❌ Tag management UI
- ❌ Analytics/reports dashboard
- ❌ Brother dashboard
- ❌ QR scanner implementation
- ❌ Offline mode
- ❌ Bid decision tools
- ❌ Round-by-round comparison
- ❌ Photo crop/preview

---

## Feature Difficulty & Value Analysis

### Settings/Admin Features

#### 1. Round Configuration Enhancement
**Current:** Basic UI exists, settings saved in round JSONB
**Difficulty:** 🟢 **EASY** (2-4 hours)
- Enhance existing `/settings` page
- Add validation, better UX
- Persist settings per round type
**Value for Pilot:** 🟡 **MEDIUM** - Nice to have, but basic version works

#### 2. User/Brother Management with Roles
**Current:** Backend has roles (ADMIN, EXEC, BROTHER), memberships table, no UI
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Create `/admin/users` page
- List members, edit roles, invite/remove
- Use existing `memberships` table and role enums
**Value for Pilot:** 🟢 **HIGH** - Critical for managing who can vote/administer
**Files to create:**
- `frontend/app/(dashboard)/admin/users/page.tsx`
- Backend routes already exist via `/api/chapters` and memberships

#### 3. Custom Questionnaire Builder
**Current:** Backend API exists (`/questionnaires`, schema in DB), no UI
**Difficulty:** 🟡 **MEDIUM** (2-3 days)
- Drag-and-drop or form-based builder
- Field types: text, select, boolean, number
- Preview mode
- Link to intake form
**Value for Pilot:** 🟡 **MEDIUM** - Useful but not critical for first rush
**Files to create:**
- `frontend/app/(dashboard)/admin/questionnaires/page.tsx`
- `frontend/app/(dashboard)/admin/questionnaires/builder/page.tsx`
- Backend: `python_server/routes.py` already has endpoints

#### 4. Tag Management UI
**Current:** Full backend API (`/tags`, create/edit/delete), no UI
**Difficulty:** 🟢 **EASY** (4-6 hours)
- Simple CRUD interface
- Color picker
- Bulk apply to PNMs
**Value for Pilot:** 🟢 **HIGH** - Tags are already used, just need UI
**Files to create:**
- `frontend/app/(dashboard)/admin/tags/page.tsx`
- Backend already complete

---

### Analytics/Reports Features

#### 5. Round-by-Round Comparison
**Current:** Results page shows single round, no comparison
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Multi-round selector
- Side-by-side or trend charts
- Score evolution over time
**Value for Pilot:** 🟡 **MEDIUM** - Nice for seeing progression, not critical
**Files to modify:**
- `frontend/app/(dashboard)/results/page.tsx`
- New component: `RoundComparison.tsx`
- Backend: New endpoint `/api/rounds/comparison`

#### 6. Brother Voting Patterns Analytics
**Current:** Votes table has voter_id, no analytics
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Aggregate votes by user
- Calculate harshness/leniency scores
- Participation rates
**Value for Pilot:** 🟡 **LOW** - Interesting but not essential for first pilot
**Files to create:**
- `frontend/app/(dashboard)/analytics/voting-patterns/page.tsx`
- Backend: New service `AnalyticsService` with vote aggregation queries

#### 7. Event Attendance Trends
**Current:** Attendance data exists, no analytics
**Difficulty:** 🟢 **EASY** (4-6 hours)
- Simple charts (attendance over time, per event)
- Engagement metrics
**Value for Pilot:** 🟡 **MEDIUM** - Useful for understanding event effectiveness
**Files to create:**
- `frontend/app/(dashboard)/analytics/attendance/page.tsx`
- Backend: New endpoint `/api/analytics/attendance`

#### 8. Export Center Enhancement
**Current:** Basic CSV exports exist
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Centralized export page
- Multiple formats (CSV, PDF, graphics)
- Scheduled exports
**Value for Pilot:** 🟢 **HIGH** - Critical for bid decisions
**Files to create:**
- `frontend/app/(dashboard)/exports/page.tsx`
- Enhance existing export endpoints

---

### PNM Intake/Onboarding Features

#### 9. Mobile-Optimized Form Enhancement
**Current:** Basic form exists, works on mobile but could be better
**Difficulty:** 🟢 **EASY** (2-4 hours)
- Better mobile layout
- Touch-friendly inputs
- Progress indicator
**Value for Pilot:** 🟢 **HIGH** - PNMs will use this on phones
**Files to modify:**
- `frontend/app/intake/page.tsx`
- Add responsive improvements

#### 10. Photo Upload with Crop/Preview
**Current:** Basic file upload, no crop
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Image cropping library (react-image-crop)
- Preview before upload
- Client-side compression
**Value for Pilot:** 🟡 **MEDIUM** - Nice UX improvement, not critical
**Files to modify:**
- `frontend/app/intake/page.tsx`
- Add crop component

#### 11. Custom Questionnaire Integration in Intake
**Current:** Questionnaires exist, not shown in intake form
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Load active questionnaire
- Render dynamic fields
- Validate and save answers
**Value for Pilot:** 🟢 **HIGH** - If using custom questions, this is essential
**Files to modify:**
- `frontend/app/intake/page.tsx`
- Use existing `/api/questionnaires` and `/api/pnms/{id}/answers`

#### 12. QR Code Generation for Sign-ups
**Current:** QR mentioned but not implemented
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Generate QR codes (qrcode library)
- Link to intake form with pre-filled event
- Display at events
**Value for Pilot:** 🟡 **MEDIUM** - Speeds up sign-ups at events
**Files to create:**
- `frontend/app/(dashboard)/events/[id]/qr/page.tsx`
- Backend: New endpoint `/api/events/{id}/qr-code`

---

### Brother Dashboard Features

#### 13. Personal Voting History & Stats
**Current:** Votes stored but no personal view
**Difficulty:** 🟢 **EASY** (4-6 hours)
- Show user's votes
- Stats (total votes, favorites, participation)
**Value for Pilot:** 🟡 **MEDIUM** - Nice for brothers to see their activity
**Files to create:**
- `frontend/app/(dashboard)/my-votes/page.tsx`
- Backend: New endpoint `/api/me/votes`

#### 14. Upcoming Events & Deadlines
**Current:** Events exist, no dashboard view
**Difficulty:** 🟢 **EASY** (2-4 hours)
- Widget on dashboard
- Show upcoming events
- Voting deadlines
**Value for Pilot:** 🟢 **HIGH** - Keeps brothers informed
**Files to modify:**
- `frontend/app/(dashboard)/page.tsx`
- Add events widget

#### 15. Quick Actions Widget
**Current:** Actions exist but scattered
**Difficulty:** 🟢 **EASY** (2-4 hours)
- Quick check-in button
- Start voting session
- Add PNM shortcut
**Value for Pilot:** 🟡 **MEDIUM** - Convenience feature
**Files to modify:**
- `frontend/app/(dashboard)/page.tsx`

#### 16. Notifications System
**Current:** No notifications
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Real-time notifications (Supabase Realtime)
- Locked rounds, new PNMs
- In-app + optional push
**Value for Pilot:** 🟡 **MEDIUM** - Helpful but not critical
**Files to create:**
- `frontend/components/Notifications.tsx`
- Backend: Broadcast via Supabase channels

---

### Event Check-In Features

#### 17. Dedicated Check-In Interface
**Current:** Basic check-in exists, not mobile-optimized
**Difficulty:** 🟢 **EASY** (4-6 hours)
- Large touch targets
- Mobile-first layout
- Search-first interface
**Value for Pilot:** 🟢 **HIGH** - Brothers will use phones at events
**Files to create:**
- `frontend/app/(dashboard)/events/[id]/checkin/page.tsx`

#### 18. QR Scanner Implementation
**Current:** Stub exists (`alert("QR scanner stub")`)
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Use browser QR scanner API or library (html5-qrcode)
- Camera access
- Fallback to manual entry
**Value for Pilot:** 🟢 **HIGH** - Speeds up check-ins significantly
**Files to modify:**
- `frontend/app/(dashboard)/events/page.tsx`
- Add QR scanner component

#### 19. Offline Mode with Sync
**Current:** No offline support
**Difficulty:** 🔴 **HARD** (3-5 days)
- Service worker
- IndexedDB for local storage
- Conflict resolution
- Sync queue
**Value for Pilot:** 🟡 **LOW** - Nice to have, but network usually available
**Files to create:**
- `frontend/public/sw.js` (service worker)
- `frontend/lib/offline.ts` (sync logic)

#### 20. Real-Time Attendee Count
**Current:** Attendance data exists, no real-time updates
**Difficulty:** 🟢 **EASY** (2-4 hours)
- Use Supabase Realtime
- Update count as check-ins happen
**Value for Pilot:** 🟡 **MEDIUM** - Nice for event organizers
**Files to modify:**
- `frontend/app/(dashboard)/events/[id]/checkin/page.tsx`
- Subscribe to Supabase channel

---

### Bid Decision/Final Review Features

#### 21. Side-by-Side PNM Comparison
**Current:** Results page shows list, no comparison
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Select 2-5 PNMs
- Compare side-by-side
- Highlight differences
**Value for Pilot:** 🟢 **HIGH** - Critical for final bid decisions
**Files to create:**
- `frontend/app/(dashboard)/compare/page.tsx`
- Component: `PNMComparison.tsx`

#### 22. Export Bid List with Supporting Data
**Current:** Basic CSV export exists
**Difficulty:** 🟡 **MEDIUM** (1 day)
- Enhanced export with all data
- Formatted for bid meeting
- Include vote history, attendance, comments
**Value for Pilot:** 🟢 **HIGH** - Essential for bid decisions
**Files to modify:**
- `frontend/app/(dashboard)/results/page.tsx`
- Backend: Enhance `/api/export/csv` endpoint

#### 23. Final Vote/Decision Tracking
**Current:** No bid decision tracking
**Difficulty:** 🟡 **MEDIUM** (1-2 days)
- Track final decisions (bid/extend/decline)
- Notes on decisions
- Audit trail
**Value for Pilot:** 🟡 **MEDIUM** - Useful for record-keeping
**Files to create:**
- New table: `bid_decisions`
- `frontend/app/(dashboard)/bids/page.tsx`
- Backend: New endpoints for bid tracking

---

## Recommended Priority for Cal Poly Pilot

### Phase 1: Critical for Launch (Week 1-2)
1. **Tag Management UI** (🟢 Easy, 🟢 High Value) - 4-6 hours
2. **User/Brother Management** (🟡 Medium, 🟢 High Value) - 1-2 days
3. **QR Scanner** (🟡 Medium, 🟢 High Value) - 1 day
4. **Dedicated Check-In Interface** (🟢 Easy, 🟢 High Value) - 4-6 hours
5. **Mobile Intake Enhancement** (🟢 Easy, 🟢 High Value) - 2-4 hours
6. **Side-by-Side PNM Comparison** (🟡 Medium, 🟢 High Value) - 1-2 days
7. **Export Center Enhancement** (🟡 Medium, 🟢 High Value) - 1 day

**Total: ~1 week of focused development**

### Phase 2: High Value Additions (Week 3-4)
8. **Custom Questionnaire Builder** (🟡 Medium, 🟡 Medium Value) - 2-3 days
9. **Custom Questionnaire in Intake** (🟡 Medium, 🟢 High Value) - 1 day
10. **Brother Dashboard Enhancements** (🟢 Easy, 🟢 High Value) - 1 day
11. **Photo Crop/Preview** (🟡 Medium, 🟡 Medium Value) - 1 day
12. **Real-Time Attendee Count** (🟢 Easy, 🟡 Medium Value) - 2-4 hours

**Total: ~1 week of development**

### Phase 3: Nice to Have (Post-Pilot)
- Round-by-round comparison
- Voting patterns analytics
- Attendance trends
- Notifications system
- Offline mode
- Final vote tracking

---

## Implementation Notes

### Quick Wins (Do These First)
1. **Tag Management UI** - Backend is done, just needs frontend
2. **Mobile Intake Enhancement** - Simple CSS/responsive improvements
3. **Brother Dashboard Widgets** - Reuse existing data, just present better
4. **Real-Time Attendee Count** - Supabase Realtime is already configured

### Requires New Backend Work
- User management (CRUD operations)
- Analytics endpoints (aggregation queries)
- Bid decision tracking (new table + endpoints)
- QR code generation (simple endpoint)

### Requires New Frontend Work
- All UI pages listed above
- QR scanner component
- Photo crop component
- Comparison tool

### Can Leverage Existing Infrastructure
- Supabase Realtime (for notifications, live updates)
- Existing tag/questionnaire/event APIs
- Current export system (just enhance)
- Voting system (just add analytics layer)

---

## Estimated Total Development Time

**Phase 1 (Critical):** ~40-50 hours (1 week)
**Phase 2 (High Value):** ~40-50 hours (1 week)
**Phase 3 (Nice to Have):** ~60-80 hours (2 weeks)

**Total for all features:** ~140-180 hours (3-4 weeks full-time)

**For Cal Poly Pilot:** Focus on Phase 1 = 1 week of development

