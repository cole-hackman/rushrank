# Topbar Navigation Implementation

This document describes the new topbar navigation layout for RushRank.

## Overview

The `DefaultPageLayout` component provides a modern topbar navigation with:
- Horizontal navigation menu (Dashboard, PNMs, Voting)
- Profile dropdown on the right
- Mobile-responsive design
- Active state highlighting
- Sticky header that stays at the top while scrolling

## File Structure

```
frontend/
├── ui/
│   ├── components/          # Re-exports of Subframe components
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── IconButton.tsx
│   │   └── Progress.tsx
│   └── layouts/
│       ├── DefaultPageLayout.tsx
│       └── index.ts
├── components/
│   ├── layouts/
│   │   └── DefaultPageLayout.tsx  # Duplicate for flexibility
│   └── subframe/          # Original Subframe components
└── app/
    └── demo-topbar/       # Example implementation
        └── page.tsx
```

## Usage

### Basic Implementation

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

export default function MyPage() {
  return (
    <DefaultPageLayout>
      <div className="p-6">
        {/* Your page content */}
      </div>
    </DefaultPageLayout>
  );
}
```

### With Subframe Components

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Avatar } from "@/ui/components/Avatar";

export default function VotingPage() {
  return (
    <DefaultPageLayout>
      <div className="p-6">
        <Badge variant="success">Active</Badge>
        <Button size="large">Submit Vote</Button>
        <Avatar size="large" image="/path/to/image.jpg">AB</Avatar>
      </div>
    </DefaultPageLayout>
  );
}
```

## Features

### Navigation Items

The topbar includes three main navigation items:
- **Dashboard** - Links to `/` (home)
- **PNMs** - Links to `/pnms`
- **Voting** - Links to `/voting`

Each navigation item:
- Shows an icon and label
- Highlights when active (dark navy background with white text)
- Has smooth hover states
- Automatically detects active route

### Profile Dropdown

The topbar includes the existing `ProfileDropdown` component on the right side, which provides:
- User avatar with initials
- Settings link
- Sign out functionality

### Mobile Responsiveness

On mobile devices (< 768px):
- Navigation moves to a bottom bar
- Items stack horizontally with icons on top
- Profile dropdown remains in the top header
- Touch-friendly tap targets

## Customization

### Changing Navigation Items

Edit the `navItems` array in `DefaultPageLayout.tsx`:

```tsx
const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/pnms",
    label: "PNMs",
    icon: Users,
  },
  {
    href: "/voting",
    label: "Voting",
    icon: Vote,
  },
  // Add more items here
];
```

### Styling

The layout uses Tailwind CSS classes and can be customized by:
1. Modifying the `cn()` class strings in `DefaultPageLayout.tsx`
2. Adjusting the brand color `#162238` (beta-navy)
3. Changing the background color from `bg-neutral-50`

### Active State Colors

Current active state:
- **Light mode**: Dark navy background (`bg-[#162238]`) with white text
- **Dark mode**: White background with dark navy text

## Demo Page

Visit `/demo-topbar` to see a complete example implementation with:
- Voting session interface
- Round status sidebar
- Progress tracking
- Profile cards with actions

## Migration from Sidebar Layout

To migrate an existing page from the sidebar layout to the topbar layout:

**Before:**
```tsx
// Layout is provided by app/(dashboard)/layout.tsx
export default function MyPage() {
  return <div>Content</div>;
}
```

**After:**
```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

export default function MyPage() {
  return (
    <DefaultPageLayout>
      <div>Content</div>
    </DefaultPageLayout>
  );
}
```

## Available Subframe Components

The following components are available via the `@/ui/components/` imports:
- `Avatar` - User avatars with image or initials
- `Badge` - Status badges with variants (default, neutral, success, warning, error)
- `Button` - Action buttons with variants and sizes
- `IconButton` - Icon-only buttons
- `Progress` - Progress bars

All components are fully typed and documented in their respective files.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled for navigation highlighting

## Performance

- Minimal re-renders using `usePathname` hook
- No external dependencies beyond lucide-react icons
- Server components where possible (children content)
- Optimized for Next.js 14+ App Router

