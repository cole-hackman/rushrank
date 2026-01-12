# Layout Comparison: Sidebar vs Topbar

## Current Sidebar Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────┐  ┌──────────────────────────────────┐   │
│  │      │  │                                   │   │
│  │  R   │  │  Header with Profile →           │   │
│  │  u   │  │                                   │   │
│  │  s   │  ├───────────────────────────────────┤   │
│  │  h   │  │                                   │   │
│  │  R   │  │                                   │   │
│  │  a   │  │         Main Content              │   │
│  │  n   │  │                                   │   │
│  │  k   │  │                                   │   │
│  │      │  │                                   │   │
│  │  ≡    │  │                                   │   │
│  │      │  │                                   │   │
│  │  📊  │  │                                   │   │
│  │  👥  │  │                                   │   │
│  │  🗳️  │  │                                   │   │
│  │  📈  │  │                                   │   │
│  │  📅  │  │                                   │   │
│  │  ⚙️  │  │                                   │   │
│  │      │  │                                   │   │
│  └──────┘  └───────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Location**: `app/(dashboard)/layout.tsx`
**Style**: Left sidebar with vertical navigation
**Navigation Items**: 6 items (Dashboard, PNMs, Voting, Results, Events, Settings)

## New Topbar Layout

```
┌─────────────────────────────────────────────────────┐
│  RushRank  [📊 Dashboard] [👥 PNMs] [🗳️ Voting]  👤│
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│                                                     │
│                    Main Content                     │
│                    (Full Width)                     │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘

Mobile:
┌─────────────────────────────────────────────────────┐
│  RushRank                                        👤 │
├─────────────────────────────────────────────────────┤
│                                                     │
│                   Main Content                      │
│                   (Full Width)                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│    [📊]        [👥]         [🗳️]                   │
│  Dashboard      PNMs       Voting                   │
└─────────────────────────────────────────────────────┘
```

**Location**: `ui/layouts/DefaultPageLayout.tsx`
**Style**: Top navigation bar with horizontal items
**Navigation Items**: 3 items (Dashboard, PNMs, Voting)

## Key Differences

| Feature | Sidebar Layout | Topbar Layout |
|---------|---------------|---------------|
| **Position** | Left side | Top |
| **Orientation** | Vertical | Horizontal |
| **Space Usage** | Takes left column | Takes top row only |
| **Content Width** | Reduced by sidebar | Full width available |
| **Mobile** | Collapsible sidebar | Bottom navigation bar |
| **Items** | 6 navigation items | 3 core items |
| **Profile** | Top right header | Top right topbar |
| **Active State** | Blue background | Navy background |

## When to Use Each

### Use Sidebar Layout (Current Default)
- ✅ Many navigation items (6+)
- ✅ Need persistent menu visibility
- ✅ Complex app structure
- ✅ Desktop-first applications

### Use Topbar Layout (New Option)
- ✅ Clean, modern look
- ✅ Mobile-first design
- ✅ Simple navigation (3-5 items)
- ✅ Maximum content width
- ✅ Social/consumer app feel
- ✅ Subframe design system compatibility

## Implementation

### Sidebar (Current)
Pages in `app/(dashboard)/*` automatically use the sidebar layout defined in `app/(dashboard)/layout.tsx`.

### Topbar (New)
Wrap your page component with `DefaultPageLayout`:

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

export default function MyPage() {
  return (
    <DefaultPageLayout>
      <div className="p-6">
        {/* content */}
      </div>
    </DefaultPageLayout>
  );
}
```

## Mixing Both Layouts

You can use both layouts in your app:
- Keep dashboard pages with sidebar
- Use topbar for specific flows (voting, intake, etc.)
- Create pages outside `(dashboard)` directory to avoid automatic sidebar

Example structure:
```
app/
├── (dashboard)/         # Uses sidebar layout
│   ├── layout.tsx
│   ├── page.tsx
│   └── settings/
├── voting-session/      # Can use topbar layout
│   └── page.tsx
└── intake/              # Can use topbar layout
    └── page.tsx
```

## Design Inspiration

The topbar layout is inspired by modern social apps and voting interfaces, providing:
- Clean, uncluttered UI
- Focus on content
- Easy mobile navigation
- Subframe design system compatibility

## Demo

**Sidebar Layout**: Visit `/` (dashboard)
**Topbar Layout**: Visit `/demo-topbar`

