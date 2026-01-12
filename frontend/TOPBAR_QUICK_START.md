# Topbar Navigation - Quick Start

## 🚀 Quick Implementation

### 1. Import the Layout

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
```

### 2. Wrap Your Content

```tsx
export default function MyPage() {
  return (
    <DefaultPageLayout>
      {/* Your page content here */}
    </DefaultPageLayout>
  );
}
```

### 3. Done! ✅

The topbar now includes:
- ✅ Navigation: Dashboard, PNMs, Voting
- ✅ Profile dropdown (right side)
- ✅ Active state highlighting
- ✅ Mobile responsive
- ✅ Dark mode support

## 📦 Available Components

Import from `@/ui/components/`:

```tsx
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Progress } from "@/ui/components/Progress";
```

## 🎨 Component Examples

### Badge
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="neutral">Round 1</Badge>
<Badge variant="warning">Pending</Badge>
```

### Button
```tsx
<Button size="large" icon={<Check />}>
  Yes
</Button>

<Button variant="destructive-secondary" icon={<X />}>
  No
</Button>
```

### Avatar
```tsx
<Avatar 
  size="large" 
  image="https://example.com/photo.jpg"
>
  AB
</Avatar>
```

### IconButton
```tsx
<IconButton 
  variant="inverse" 
  size="large" 
  icon={<Star />}
  onClick={() => {}}
/>
```

### Progress
```tsx
<Progress value={66} />
```

## 🎯 Demo

Visit **`/demo-topbar`** to see a complete voting interface example!

## 📱 Navigation Items

Current items in the topbar:
- **Dashboard** → `/`
- **PNMs** → `/pnms`
- **Voting** → `/voting`

Active route is automatically highlighted in **dark navy** with white text.

## 🎨 Design Details

- **Brand Color**: `#162238` (navy)
- **Background**: `bg-neutral-50` (light gray)
- **Active State**: Navy background + white text
- **Hover**: Subtle gray background
- **Mobile**: Items move to bottom navigation bar

## ⚡ Tips

1. **Full Width Content**: The layout provides full-width flexibility
2. **Custom Padding**: Add your own padding to page content
3. **Dark Mode**: Automatically supported via Tailwind
4. **Icons**: Use `lucide-react` icons for consistency

## 📚 Full Documentation

See `TOPBAR_NAVIGATION.md` for complete documentation.

