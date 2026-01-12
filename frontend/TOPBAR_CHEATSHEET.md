# Topbar Navigation - Cheat Sheet

## 📋 Quick Copy-Paste Examples

### 1️⃣ Basic Page with Topbar

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

export default function MyPage() {
  return (
    <DefaultPageLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">My Page</h1>
      </div>
    </DefaultPageLayout>
  );
}
```

### 2️⃣ Voting Interface Card

```tsx
<div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
  <div className="flex items-center gap-2">
    <Badge variant="success">Active</Badge>
    <span className="text-sm text-neutral-600">Round 1</span>
  </div>
</div>
```

### 3️⃣ Action Buttons Row

```tsx
<div className="flex gap-4">
  <Button 
    variant="destructive-secondary" 
    icon={<X />}
  >
    No
  </Button>
  <Button 
    variant="neutral-secondary" 
    icon={<HelpCircle />}
  >
    Don't Know
  </Button>
  <Button icon={<Check />}>
    Yes
  </Button>
</div>
```

### 4️⃣ Profile Card

```tsx
<div className="flex items-center gap-3">
  <Avatar 
    size="large" 
    image="https://example.com/photo.jpg"
  >
    AB
  </Avatar>
  <div>
    <div className="font-bold">Alex Brown</div>
    <div className="text-sm text-neutral-600">Computer Science</div>
  </div>
</div>
```

### 5️⃣ Progress Indicator

```tsx
<div className="space-y-2">
  <div className="flex justify-between">
    <span className="text-sm">Progress</span>
    <span className="text-sm font-bold">8/12</span>
  </div>
  <Progress value={66} />
  <span className="text-xs text-neutral-600">66% complete</span>
</div>
```

### 6️⃣ Status Card

```tsx
<div className="rounded-lg bg-[#162238] p-4 text-white">
  <div className="flex items-center gap-2">
    <Lock className="h-4 w-4" />
    <span className="font-bold">Round will lock in 2:45</span>
  </div>
  <p className="mt-2 text-sm text-neutral-300">
    Submit votes before deadline
  </p>
</div>
```

### 7️⃣ Badge Variants

```tsx
<Badge>Default</Badge>
<Badge variant="neutral">Neutral</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
```

### 8️⃣ Button Variants

```tsx
<Button>Default</Button>
<Button variant="neutral-secondary">Secondary</Button>
<Button variant="neutral-tertiary">Tertiary</Button>
<Button variant="destructive-secondary">Destructive</Button>
```

### 9️⃣ Icon Button

```tsx
<IconButton 
  icon={<Star />} 
  variant="inverse" 
  size="large"
  onClick={() => console.log('Clicked')}
/>
```

### 🔟 Full Page Layout

```tsx
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

export default function VotingPage() {
  return (
    <DefaultPageLayout>
      <div className="min-h-screen bg-neutral-50 p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Voting Session</h1>
            <Badge variant="success">Active</Badge>
          </div>

          {/* Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {/* Main content */}
            </div>
            <div>
              {/* Sidebar */}
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
```

## 🎨 Common Colors

```tsx
// Brand Navy
bg-[#162238]
text-[#162238]

// Backgrounds
bg-neutral-50      // Light gray page background
bg-white           // Card background
bg-neutral-100     // Subtle hover

// Text
text-neutral-600   // Secondary text
text-neutral-900   // Primary text
text-white         // On dark backgrounds

// Borders
border-neutral-200 // Light border
border-neutral-300 // Medium border
```

## 📐 Common Layouts

### Two Column
```tsx
<div className="grid gap-6 lg:grid-cols-2">
  <div>{/* Left */}</div>
  <div>{/* Right */}</div>
</div>
```

### Three Column
```tsx
<div className="grid gap-6 lg:grid-cols-3">
  <div>{/* Col 1 */}</div>
  <div>{/* Col 2 */}</div>
  <div>{/* Col 3 */}</div>
</div>
```

### Centered Container
```tsx
<div className="mx-auto max-w-6xl px-6 py-8">
  {/* Content */}
</div>
```

### Card
```tsx
<div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
  {/* Card content */}
</div>
```

## 🔧 Common Utilities

### Spacing
```tsx
gap-2    // 0.5rem (8px)
gap-4    // 1rem (16px)
gap-6    // 1.5rem (24px)

p-4      // padding all sides
px-6     // padding horizontal
py-4     // padding vertical

m-4      // margin all sides
mb-6     // margin bottom
```

### Sizing
```tsx
w-full   // width 100%
h-full   // height 100%
max-w-6xl // max width 72rem

h-8      // height 2rem
w-80     // width 20rem
```

### Flex
```tsx
flex items-center justify-between
flex flex-col gap-4
flex items-start gap-2
flex-wrap
```

## 🎯 Import Shortcuts

```tsx
// Layout
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";

// Components (Subframe)
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Progress } from "@/ui/components/Progress";

// Icons (Lucide)
import { 
  Check, 
  X, 
  HelpCircle, 
  Star, 
  Users,
  BarChart3,
  Clock,
  Lock 
} from "lucide-react";

// Utils
import { cn } from "@/lib/utils";
```

## 🚀 One-Line Starters

```bash
# Demo page
Visit: /demo-topbar

# Import layout
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout"

# Import all components
import { Avatar, Badge, Button, IconButton, Progress } from "@/ui/components"
```

## 💡 Pro Tips

1. **Active States**: Topbar auto-detects active route
2. **Mobile**: Bottom nav appears on mobile automatically
3. **Dark Mode**: All components support dark mode
4. **Icons**: Use lucide-react for consistency
5. **Spacing**: Use p-6 for page padding
6. **Cards**: Use rounded-lg, border, shadow-sm combo
7. **Container**: max-w-6xl for content width
8. **Navy**: #162238 is the brand color

---

**Quick Links**:
- Demo: `/demo-topbar`
- Docs: `TOPBAR_NAVIGATION.md`
- Comparison: `LAYOUT_COMPARISON.md`

