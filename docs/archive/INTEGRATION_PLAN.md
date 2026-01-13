# RushRank Subframe UI Integration Plan

## Overview
Integrate Subframe-designed pages into the RushRank app, replacing hardcoded demo data with live backend data.

## Current State Analysis

### Routes & Pages
- `/events` - Basic events list (needs replacement)
- `/settings` - Basic round settings (needs replacement)
- `/admin/users` - User management table (needs enhancement)
- `/admin/tags` - Tag management cards (needs enhancement)
- `/login` - Basic login form (needs replacement)

### API Layer
- **Location**: `frontend/lib/api.ts`
- **Function**: `api<T>(path, opts?)` - generic fetch wrapper
- **Auth**: Bearer token from `localStorage.getItem("access_token")`
- **Base URL**: `process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"`

### Backend Models (FastAPI)
- **Events**: `GET /events?chapter_id=`, `POST /events`, `Event` model with `date`, `name`, `location`, `type`, etc.
- **Users/Memberships**: `GET /memberships?chapter_id=`, `PUT /memberships/:id`, roles: `admin`, `member`, `observer`
- **Tags**: `GET /tags?chapter_id=`, `POST /tags`, `PUT /tags/:id`, `DELETE /tags/:id`
- **Round Settings**: Stored in `voting_rounds.settings` JSONB with `anonymous`, `swipeMode`, `execWeight`, `timerSecs`
- **Questionnaires**: `GET /questionnaires?chapter_id=`, `POST /questionnaires`, schema stored as JSONB

### Components Available
- `DefaultPageLayout` - exists in `@/components/layouts/DefaultPageLayout`
- UI components: `Badge`, `Button`, `Table`, `TextField`, `Switch`, `Progress`, etc. from `@/components/ui/*`

## Integration Mapping

### 1. Events Page (`/events`)
**File**: `frontend/app/(dashboard)/events/page.tsx`
**Subframe Reference**: `attached_assets/events-page.tsx`

**Changes**:
- Replace entire page with `RushRankEventPage` structure
- Wire stats cards: total events, total attendance, avg attendance, upcoming count
- Populate table with real events from `GET /events?chapter_id=`
- Wire search/filter to client-side filtering
- Wire "Create Event" form to `POST /events`
- Wire "Export Attendance" to export endpoint (TODO if not exists)

### 2. Settings & Admin Page (`/settings`)
**File**: `frontend/app/(dashboard)/settings/page.tsx`
**Subframe Reference**: `attached_assets/settings-and-admin.tsx`

**Changes**:
- Replace with composite layout (4 sections: Round Config, User Mgmt, Tag Mgmt, Questionnaire)
- **Round Configuration**: Load from active round settings, save via `POST /rounds` with settings
- **User Management**: Show summary table (link to `/admin/users` for full management)
- **Tag Management**: Show inline tag tiles, wire create/edit/delete
- **Questionnaire Builder**: Load questions from questionnaire schema, wire add/edit/delete

### 3. Tag Management Cards Page (`/admin/tags`)
**File**: `frontend/app/(dashboard)/admin/tags/page.tsx`
**Subframe Reference**: `attached_assets/tag-management.tsx`

**Changes**:
- Enhance existing page with Subframe card-based design
- Add stats cards: total tags, most used tag, tagged PNMs count
- Replace grid with card layout from Subframe
- Wire "Bulk Apply Tags" section (TODO if backend not ready)

### 4. Login Page (`/login`)
**File**: `frontend/app/login/page.tsx`
**Subframe Reference**: `attached_assets/updated-login.tsx`

**Changes**:
- Replace with `RushRankLogin` design
- Keep existing Supabase auth logic
- Add "Forgot password?" handler (Supabase reset flow)

### 5. User Management Page (`/admin/users`)
**File**: `frontend/app/(dashboard)/admin/users/page.tsx`
**Subframe Reference**: `attached_assets/user-management.tsx`

**Changes**:
- Enhance with Subframe design (better metrics cards, table styling)
- Keep existing API calls and logic
- Improve visual presentation

## Implementation Steps

1. ✅ Analyze codebase (done)
2. Create/update API helper functions if needed
3. Integrate Events Page
4. Integrate Settings & Admin Page
5. Enhance Tag Management Page
6. Update Login Page
7. Enhance User Management Page
8. Add loading/error states
9. Test and verify

## API Endpoints Reference

### Events
- `GET /events?chapter_id={id}` - List events
- `POST /events?chapter_id={id}` - Create event
- `GET /events/{id}/attendance` - Get attendance (if exists)

### Users/Memberships
- `GET /memberships?chapter_id={id}` - List memberships
- `PUT /memberships/{id}?chapter_id={id}` - Update role
- `POST /memberships/invite` - Invite user (TODO if not exists)

### Tags
- `GET /tags?chapter_id={id}` - List tags
- `POST /tags?chapter_id={id}` - Create tag
- `PUT /tags/{id}?chapter_id={id}` - Update tag
- `DELETE /tags/{id}?chapter_id={id}` - Delete tag

### Round Settings
- `GET /rounds/active?chapter_id={id}` - Get active round with settings
- `POST /rounds?chapter_id={id}` - Create round with settings

### Questionnaires
- `GET /questionnaires?chapter_id={id}` - List questionnaires
- `POST /questionnaires?chapter_id={id}` - Create questionnaire
- `PUT /questionnaires/{id}?chapter_id={id}` - Update questionnaire

## Notes

- All pages need to handle `chapter_id` (get from first chapter or user's chapter)
- Loading states should use skeleton/spinner
- Error states should show toast + retry button
- Type safety: use existing types from `shared/schema.ts` or create new ones
- Preserve existing auth guards (`Protected`, `AdminProtected`)

