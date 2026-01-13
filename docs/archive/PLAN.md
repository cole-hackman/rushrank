# Phase 1 Implementation Plan - Cal Poly Pilot

## Overview
Implement 6 high-value features for Cal Poly pilot without modifying backend contracts or DB schema. All changes are frontend-only, leveraging existing APIs.

## Constraints
- ❌ No SQL migrations or schema changes
- ❌ No API route/response shape changes
- ✅ Use existing endpoints as-is
- ✅ Beta Theta Pi colors: navy `#013068`, gray `#bebebe`, surface `#fefefe`
- ✅ All API calls to `http://localhost:8000/api`
- ✅ Include `chapter_id` in all queries

---

## Feature 1: Tag Management UI

### Files to Create
- `frontend/app/(dashboard)/admin/tags/page.tsx` - Main tag management page
- `frontend/components/admin/TagForm.tsx` - Create/edit tag form with color picker
- `frontend/components/admin/BulkTagModal.tsx` - Bulk apply/remove tags from PNMs

### Files to Modify
- `frontend/app/(dashboard)/pnms/page.tsx` - Add bulk tag selection and "Bulk Tag" button
- `frontend/app/(dashboard)/layout.tsx` - Add "Admin" nav item (conditionally shown)

### Implementation Details
**Tag Management Page:**
- List all tags with color swatches
- Create new tag: label + color picker (simple color input or predefined palette)
- Edit existing tag (inline or modal)
- Delete tag with confirmation
- Use existing APIs: `GET /api/tags?chapter_id=`, `POST /api/tags?chapter_id=`, `DELETE /api/tags/{id}?chapter_id=`

**Bulk Tagging:**
- On PNMs page, add checkbox column for multi-select
- "Bulk Tag" button appears when 1+ PNMs selected
- Modal shows tag list with checkboxes
- Apply/remove tags via `POST /api/pnms/{id}/tags/{tag_id}` and `DELETE /api/pnms/{id}/tags/{tag_id}`
- Optimistic UI update, toast on success

**Admin Check:**
- Check user role via `/api/me` endpoint (should return memberships with roles)
- Only show Admin nav item and `/admin/*` routes if user has ADMIN role
- Create `frontend/components/AdminProtected.tsx` wrapper

### Acceptance
- Create "Athlete" tag with green color
- Filter PNMs by tag on `/pnms`
- Bulk select 3 PNMs, apply tag, see immediate update

---

## Feature 2: QR Scanner + Dedicated Check-In

### Files to Create
- `frontend/app/(dashboard)/events/[id]/checkin/page.tsx` - Mobile-first check-in interface
- `frontend/components/events/QrScanner.tsx` - QR scanner component
- `frontend/lib/qr.ts` - QR code generation utilities (if needed)

### Files to Modify
- `frontend/app/(dashboard)/events/page.tsx` - Add "Open Check-In" button per event
- `frontend/package.json` - Add QR scanner dependency (`html5-qrcode` or `@yudiel/react-qr-scanner`)

### Implementation Details
**Check-In Page:**
- Mobile-first layout: large search input at top, large touch targets
- Two modes: Search (type PNM name/ID) or Scan QR
- Search results show PNM cards with "Check In" button
- QR scanner opens camera, scans PNM ID, auto-checks in
- Live attendee count (poll every 2-3 seconds or use Supabase Realtime if available)
- Use existing: `POST /api/events/{event_id}/attendance` with `{event_id, pnm_id}`

**QR Scanner:**
- Use `html5-qrcode` library (lightweight, browser-native)
- Request camera permission gracefully
- Fallback to manual entry if denied
- Display scanned PNM info before confirming check-in

**Navigation:**
- From `/events`, click "Open Check-In" → navigate to `/events/{id}/checkin`
- Back button returns to events list

### Acceptance
- Open check-in page on iPhone, scan QR code, see count increment
- Search for PNM, tap to check in, see success toast
- Camera permission denied → graceful fallback to search

---

## Feature 3: User/Brother Management UI

### Files to Create
- `frontend/app/(dashboard)/admin/users/page.tsx` - User list with role management
- `frontend/components/admin/UserRoleEditor.tsx` - Role change dropdown/editor
- `frontend/components/AdminProtected.tsx` - Route protection for admin pages

### Files to Modify
- `frontend/app/(dashboard)/layout.tsx` - Conditionally show "Admin" nav item
- `frontend/lib/api.ts` - Add helper to check admin status

### Implementation Details
**User Management Page:**
- List all chapter members (need to check if endpoint exists: likely `/api/chapters/{id}/members` or similar)
- If no endpoint exists, propose minimal addition: `GET /api/memberships?chapter_id=` returning list with user details
- Display: name, email, role (ADMIN/EXEC/BROTHER), actions
- Role editor: dropdown to change role
- Invite section: email input + "Invite" button (stub to copy invite link for now)

**Admin Protection:**
- `AdminProtected` component checks `/api/me` for admin role
- Redirects non-admins to dashboard with toast
- Wrap `/admin/*` routes

**Role Change:**
- Use existing membership update endpoint (check if `PUT /api/memberships/{id}` exists)
- If not, propose: `PUT /api/memberships/{id}` with `{role: "ADMIN"|"EXEC"|"BROTHER"}`
- Optimistic update, refresh on success

### Backend Proposal (if needed)
If membership management endpoints don't exist:
```
GET /api/memberships?chapter_id={id} - List memberships with user details
PUT /api/memberships/{id} - Update role: {role: "ADMIN"|"EXEC"|"BROTHER"}
```
Add to `PLAN.md` backend section for approval.

### Acceptance
- Admin can see user list, change role to EXEC, refresh shows persisted change
- Non-admin tries to access `/admin/users` → redirected with error toast

---

## Feature 4: Side-by-Side PNM Comparison

### Files to Create
- `frontend/app/(dashboard)/compare/page.tsx` - Comparison page
- `frontend/components/compare/ComparisonGrid.tsx` - Grid layout for 2-5 PNMs
- `frontend/components/compare/PNMComparisonCard.tsx` - Individual PNM card in comparison

### Files to Modify
- `frontend/app/(dashboard)/pnms/page.tsx` - Add multi-select checkboxes, "Compare" button
- `frontend/app/(dashboard)/layout.tsx` - Add "Compare" nav item (or keep as action-only)

### Implementation Details
**PNMs Page Enhancement:**
- Add checkbox column (first column)
- "Compare" button in toolbar (disabled until 2-5 selected)
- Store selected IDs in URL params or state
- Navigate to `/compare?ids=id1,id2,id3`

**Comparison Page:**
- Load selected PNMs via `/api/pnms/{id}` for each
- Grid layout: 2 columns (desktop), 1 column (mobile)
- Each card shows: photo, name, major, year, tags, attendance count, vote breakdown (Yes/No/Unknown), favorites count, recent notes preview
- Export button (links to Feature 6)

**Data Loading:**
- Fetch PNM details in parallel
- Fetch vote stats from `/api/rounds/{round_id}/results` filtered by PNM IDs
- Show loading skeleton while fetching

### Acceptance
- Select 3 PNMs on `/pnms`, click "Compare", see side-by-side grid
- Desktop: 3 columns, tablet: 2 columns, mobile: 1 column
- All data loads, no horizontal scroll

---

## Feature 5: Export Center Enhancement

### Files to Create
- `frontend/app/(dashboard)/exports/page.tsx` - Export hub page
- `frontend/lib/export.ts` - Export utilities (CSV generation helpers)

### Files to Modify
- `frontend/app/(dashboard)/pnms/page.tsx` - Update export to use export center
- `frontend/app/(dashboard)/compare/page.tsx` - Add export button
- `frontend/app/(dashboard)/results/page.tsx` - Link to export center

### Implementation Details
**Export Center Page:**
- Section: "Export All PNMs" → button downloads CSV
- Section: "Export Filtered PNMs" → respects current `/pnms` filters (pass via URL params or state)
- Section: "Export Comparison Set" → if coming from compare page
- Section: "Export Event Attendance" → per event CSV
- Section: "PNM Graphics" → stub/placeholder for future 1080x1350 images

**CSV Generation:**
- Use existing `/api/export/csv?entity=pnms&chapter_id=` endpoint
- For filtered: append query params from PNMs page filters
- For comparison: pass selected IDs
- Client-side download via `window.open()` or fetch + blob download

**Graphics Export Stub:**
- Placeholder UI showing "Coming soon: 1080x1350 PNG per PNM"
- Link to existing `/api/pnms/{id}/share-card` endpoint if available

### Acceptance
- From `/exports`, export "All PNMs" → downloads CSV with all fields
- From `/pnms` with tag filter, go to `/exports` → "Export Filtered" respects tag
- From `/compare`, export → CSV includes only compared PNMs

---

## Feature 6: Mobile Intake Improvements

### Files to Modify
- `frontend/app/intake/page.tsx` - Enhance mobile layout, add photo crop

### Files to Create (optional)
- `frontend/components/intake/PhotoCrop.tsx` - Photo cropping component (if using react-image-crop)

### Implementation Details
**Mobile Layout:**
- Increase touch target sizes (min 44x44px)
- Better spacing: `py-4` for inputs, `gap-6` between sections
- Progress indicator: "Step 1 of 2" or progress bar
- Single-column layout on mobile (already mostly there, just polish)

**Photo Crop (Optional):**
- Add `react-image-crop` dependency
- After file selection, show crop modal
- Crop to square or 4:3 ratio
- Preview cropped image
- Upload cropped blob (keep existing upload flow)
- If crop fails or user skips, fall back to original upload

**Form Improvements:**
- Add stepper: "Personal Info" → "Photo & Details"
- Better error states: inline validation messages
- Success state: show checkmark, auto-redirect after 2s

### Acceptance
- On iPhone, complete intake one-handed
- Crop photo, see preview, submit successfully
- If photo upload fails, PNM still created (existing behavior)

---

## Implementation Order

1. **Tag Management UI** (Feature 1) - Start here
2. **QR Scanner + Check-In** (Feature 2)
3. **User Management** (Feature 3) - May need backend proposal
4. **Side-by-Side Comparison** (Feature 4)
5. **Export Center** (Feature 5)
6. **Mobile Intake Polish** (Feature 6)

---

## Dependencies to Add

```json
{
  "html5-qrcode": "^2.3.8",  // For QR scanning
  "react-image-crop": "^11.0.5"  // Optional, for photo crop
}
```

---

## Admin Protection Strategy

Create `frontend/components/AdminProtected.tsx`:
```typescript
// Checks /api/me for admin role in any membership
// Redirects non-admins with toast
// Shows loading state while checking
```

Use on all `/admin/*` routes.

---

## Color Usage

All new components use:
- Primary buttons: `bg-beta-navy text-white`
- Borders: `border-beta-gray/30`
- Backgrounds: `bg-beta-surface` or `bg-white`
- Focus rings: `focus:ring-beta-navy`
- Tag colors: Use `color` field from backend, display as `bg-[${color}]` or style attribute

---

## Testing Checklist

After each feature:
1. ✅ API calls log to console with `[API]` prefix
2. ✅ No CORS errors
3. ✅ `chapter_id` included in all queries
4. ✅ Mobile responsive (test on iPhone simulator)
5. ✅ Admin routes protected
6. ✅ Toast notifications on success/error
7. ✅ Loading states shown
8. ✅ Error states handled gracefully

---

## Backend Endpoints Used (Existing)

- `GET /api/tags?chapter_id=` - List tags
- `POST /api/tags?chapter_id=` - Create tag
- `DELETE /api/tags/{id}?chapter_id=` - Delete tag
- `POST /api/pnms/{id}/tags/{tag_id}` - Add tag to PNM
- `DELETE /api/pnms/{id}/tags/{tag_id}` - Remove tag from PNM
- `POST /api/events/{id}/attendance` - Check in PNM
- `GET /api/me` - Get current user with memberships
- `GET /api/pnms?chapter_id=` - List PNMs
- `GET /api/pnms/{id}` - Get PNM details
- `GET /api/rounds/{id}/results` - Get round results
- `GET /api/export/csv?entity=pnms&chapter_id=` - Export CSV

## Backend Endpoints Needed (Propose if missing)

- `GET /api/memberships?chapter_id=` - List chapter memberships with user details
- `PUT /api/memberships/{id}` - Update membership role

If these don't exist, add minimal proposal to this plan for approval before implementing Feature 3.

