# RushRank Frontend Setup Guide

## 🎨 Component Integration Complete

This frontend now uses premium components from [21st.dev](https://21st.dev) integrated with Subframe-inspired designs:

### Components Used

1. **Aceternity Sidebar** - Global navigation with hover-expand (desktop) and slide-over (mobile)
2. **Spectrum UI Profile Dropdown** - Animated user menu with theme toggle
3. **Ruixen Table** - Enhanced PNM management table with sorting/filtering  
4. **Aceternity Signup Form** - Beautiful PNM intake form with photo upload
5. **Tinder-like Swipe** - Voting interface with gesture support

### Subframe Features Adapted

From your Subframe designs, I've implemented:

- **Voting View**: Round status sidebar, voter progress tracking, live stats
- **PNM Dashboard**: Attendance counts, Yes%, favorites column
- **Results Page**: Statistics cards, ranked table with vote breakdowns
- **PNM Profile**: Tabs for comments/attendance/questionnaire

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase project (or local Supabase)

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Start the dev server:
```bash
npm run dev
```

Frontend will be available at: **http://localhost:3000**

### Backend Setup

```bash
# From project root
python3 START_FASTAPI.py
```

Backend will be available at: **http://localhost:8000**

---

## 📍 Routes & Features

### Public Routes
- `/intake` - PNM self-intake form (Aceternity Signup Form style)
- `/login` - User login

### Dashboard Routes (Protected)
- `/` - Dashboard overview with stats cards
- `/pnms` - PNM management table (Ruixen Table + filters)
- `/pnms/[id]` - PNM profile (comments, attendance, questionnaire tabs)
- `/voting` - Live voting with swipe interface + round status
- `/results` - Results with statistics and ranking
- `/events` - Event management and check-ins
- `/settings` - Round configuration

---

## 🔌 Backend Integration

### New Endpoints Added

```python
# PNM-specific
GET  /api/pnms/{pnm_id}/attendance     # Attendance history
GET  /api/pnms/{pnm_id}/questionnaire  # Questionnaire responses

# Round status (for realtime)
GET  /api/rounds/{round_id}/status     # Votes collected, total voters, timer

# Enhanced PNMs list
GET  /api/pnms?chapter_id=xxx          # Now includes attendance_count, yes_percentage, is_favorite
```

### Existing Endpoints Used

```python
# Notes (Comments)
GET    /api/pnms/{pnm_id}/notes
POST   /api/pnms/{pnm_id}/notes
DELETE /api/notes/{note_id}

# Voting
GET  /api/rounds/active?chapter_id=xxx
POST /api/rounds/{round_id}/votes
GET  /api/rounds/{round_id}/results

# Events
GET  /api/events?chapter_id=xxx
POST /api/events/{event_id}/attendance

# Export
GET  /api/exports/pnms.csv?chapter_id=xxx
GET  /api/exports/rounds/{round_id}.csv
```

---

## ✨ Key Features

### 1. Voting Page (`/voting`)

**Layout:**
- Main area: Tinder-style swipe cards
- Sidebar: Round status & your progress

**Features:**
- ✅ Swipe gestures (Right=Yes, Left=No, Up=Don't Know)
- ✅ Star button for favorites
- ✅ Real-time vote tracking (polls every 5s)
- ✅ Progress indicators
- ✅ Photo with gradient overlay
- ✅ Tag pills display

**Realtime Updates:**
- Votes collected counter updates every 5 seconds
- Progress bar shows completion percentage

### 2. PNM Dashboard (`/pnms`)

**Features:**
- ✅ Photo thumbnails with initials fallback
- ✅ Search by name, major, hometown
- ✅ Tag filtering (multi-select)
- ✅ Favorites-only filter
- ✅ Attendance count column (4/6 events)
- ✅ Yes % column (color-coded)
- ✅ Favorites indicator (filled star)
- ✅ Action dropdown per row

**Columns:**
1. Photo (thumbnail)
2. Name
3. Major
4. Hometown
5. Year
6. Tags (pills)
7. Attendance (X/Y events)
8. Yes % (green ≥80%, blue ≥60%)
9. Favorites (star icon)
10. Actions (dropdown menu)

### 3. Results Page (`/results`)

**Features:**
- ✅ 4 Statistics cards (Total, Avg Yes%, Favorites, Controversial)
- ✅ Ranked table by Yes %
- ✅ Vote breakdown (Yes/No/Unknown counts with icons)
- ✅ Progress bars for scores
- ✅ Status badges (Top Choice, Strong, Controversial, Moderate)
- ✅ Search filtering
- ✅ Export CSV

**Auto-Categorization:**
- **Top Choice** (≥85% Yes) - Green with checkmark
- **Strong** (70-84% Yes) - Green
- **Controversial** (40-60% Yes) - Yellow with warning icon
- **Moderate** (<70% Yes) - Gray

### 4. PNM Profile (`/pnms/[id]`)

**Layout:**
- Left sidebar: Profile card + Quick Stats
- Right content: Tabbed interface

**Tabs:**

1. **Comments Tab:**
   - ✅ List of comments with timestamps
   - ✅ Anonymous/attributed display
   - ✅ Add comment textarea
   - ✅ "Post anonymously" checkbox
   - ✅ Delete button (admin only)
   - ✅ Time ago formatting

2. **Attendance Tab:**
   - ✅ Event list with check icons
   - ✅ Event name, date, check-in time
   - ✅ Attended/missed status

3. **Questionnaire Tab:**
   - ✅ Q&A format in styled cards
   - ✅ Loads from backend `/pnms/{id}/questionnaire`

### 5. Intake Form (`/intake`)

**Features:**
- ✅ Aceternity form styling (gradient button, labels)
- ✅ Photo capture with preview
- ✅ Fields: Name, Year, Email, Phone, Major, Hometown, Fun Fact
- ✅ Photo upload to Supabase Storage
- ✅ Success screen with redirect

---

## 🎨 Design System

**Colors:**
- Primary: Blue-to-purple gradient
- Success: Green (≥80% Yes)
- Info: Blue (60-79% Yes)
- Warning: Yellow (controversial votes)
- Danger: Red (rejections)

**Typography:**
- Headings: Bold, large scale
- Body: Neutral colors, readable sizes
- Captions: Small, muted

**Spacing:**
- Consistent 4px grid
- Generous padding on cards (24px)
- Proper gap spacing (12-24px)

**Dark Mode:**
- Full support via ThemeProvider
- Respects system preference
- Toggle in profile dropdown

---

## 📊 Data Flow

### Voting Flow
```
1. User loads /voting
2. Frontend fetches active round + PNMs
3. User swipes or clicks buttons
4. Vote POSTed to /rounds/{id}/votes
5. Local stats updated immediately
6. Round status polled every 5s for collective progress
```

### PNM Profile Flow
```
1. User clicks PNM name
2. Navigate to /pnms/{id}
3. Parallel fetch:
   - GET /pnms/{id} (core data)
   - GET /pnms/{id}/notes (comments)
   - GET /pnms/{id}/attendance (events)
   - GET /pnms/{id}/questionnaire (responses)
4. Tabs show different data views
5. Post comment → POST /pnms/{id}/notes
6. Delete → DELETE /notes/{id}
```

### Filtering Flow
```
1. Type in search box → client-side filter
2. Click tag chips → filter by tags (multi-select)
3. Toggle favorites → show only favorited PNMs
4. All filters combine (AND logic)
```

---

## 🐛 Troubleshooting

### "Failed to load PNMs"
- Check that backend is running on port 8000
- Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Ensure you're logged in (check localStorage for `access_token`)

### "Failed to upload photo"
- Check Supabase storage bucket `pnm-photos` exists
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Ensure RLS policies allow uploads

### "No PNMs in this round"
- Create a round in `/settings` or admin panel
- Add PNMs to the round's `selected_pnm_ids`

### Sidebar not expanding
- Ensure `framer-motion` is installed
- Check browser console for errors
- Try disabling animations in sidebar (set `animate={false}`)

---

## 🔧 Development Commands

```bash
# Frontend
cd frontend
npm run dev       # Start dev server (port 3000)
npm run build     # Production build
npm run typecheck # TypeScript validation
npm run lint      # ESLint

# Backend
python3 START_FASTAPI.py  # Start FastAPI (port 8000)
```

---

## 📦 Dependencies

### Frontend
- **Next.js 14** - App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **Tabler Icons** - Additional icons
- **Class Variance Authority** - Component variants
- **Tailwind Merge** - ClassName utilities

### Backend
- **FastAPI** - API framework
- **asyncpg** - Postgres async driver
- **Supabase** - Auth & Storage
- **Pillow** - Image processing (PNM cards)

---

## 📝 TODO: Backend Enhancements

To fully support all frontend features, you may want to add:

1. **Questionnaire Service** - Ensure `get_pnm_answers()` returns formatted Q&A
2. **Vote Stats** - Add endpoint to get user's vote stats for progress card
3. **Realtime WebSocket** - Replace polling with WebSocket for instant updates
4. **Photo Compression** - Compress large images server-side
5. **CSV Exports** - Ensure attendance and questionnaire fields are included

---

## 🎯 Testing Checklist

- [ ] Login works and stores token
- [ ] Dashboard stats load correctly
- [ ] Can create PNM via intake form
- [ ] Photo upload succeeds to Supabase
- [ ] PNM table shows with all columns
- [ ] Search and tag filtering works
- [ ] Can navigate to PNM profile
- [ ] Comments post and display correctly
- [ ] Attendance tab loads event history
- [ ] Voting page loads active round
- [ ] Swipe gestures work (desktop drag, mobile touch)
- [ ] Vote buttons work
- [ ] Vote stats update in sidebar
- [ ] Results page shows ranked PNMs
- [ ] Export CSV downloads correctly

---

## 🌐 Production Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Railway/Render/Fly.io)
```bash
# Set environment variables in platform:
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Environment Variables
See `.env.local.example` for required variables.

---

## 📸 Screenshots

Key pages to screenshot:
1. Dashboard overview
2. PNM table with filters active
3. PNM profile (all 3 tabs)
4. Voting page with sidebar
5. Results page with stats cards
6. Intake form

---

Built with ❤️ using 21st.dev components and Subframe designs

