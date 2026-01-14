# Features to Reimplement

This document tracks features that were hidden or removed from the UI and need to be reimplemented in the future.

## Live Voting (Removed Previously)
- Live voting functionality was hidden/removed. Code likely resides in `app/(dashboard)/voting`.

## Admin & Settings Pages (Hidden 2026-01-13)
The following navigation items and pages were hidden from the `DashboardLayout` in `frontend/app/(dashboard)/layout.tsx`:

### Admin Dropdown
- **Settings**: `/settings` - Chapter and user settings.
- **Tag Management**: `/admin/tags` - Managing PNM tags.
- **User Management**: `/admin/users` - Managing chapter members/users.
- **Analytics**: `/admin/analytics` - Chapter analytics.

### User Profile Menu
- **Profile**: Link to `/settings` (or profile specific page).
- **Settings**: Link to `/settings`.

### How to Restore
1. Open `frontend/app/(dashboard)/layout.tsx`.
2. Uncomment the code blocks marked with `ADMIN PAGES HIDDEN`, `ADMIN DROPDOWN HIDDEN`, and `USER MENU ITEMS HIDDEN`.
3. Ensure the routes still exist in `frontend/app`.
