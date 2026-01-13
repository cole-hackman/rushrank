# ✅ Subframe Setup Complete

## What Was Fixed

Your codebase now has proper Subframe integration! Here's what was set up:

### 1. ✅ Installed `@subframe/core`
- Added the package for Subframe icons and core utilities
- All your `Feather*` icon imports will now work correctly

### 2. ✅ Set Up Subframe CLI
- Installed `@subframe/cli` as a dev dependency
- Synced all components from your Subframe project (ID: `3122e3d36a51`)
- Components are now in `/frontend/ui/components/`

### 3. ✅ Updated Tailwind Config
- Merged Subframe's theme colors (brand, neutral, error, warning, success)
- Added Subframe's custom font sizes (caption, body, heading-1/2/3)
- Added Work Sans font family
- Added Subframe's custom spacing, shadows, and border radius
- Included `./ui/**/*.{ts,tsx}` in content paths

### 4. ✅ Component Structure
- Components are synced and use the proper Subframe API:
  - `TextField` with `TextField.Input` child component
  - `Button` with proper variants (brand-primary, neutral-secondary, etc.)
  - All other Subframe components are available

## How to Use Subframe Components

### Import Components
```tsx
import { TextField } from "@/ui/components/TextField";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
// ... etc
```

### Import Icons
```tsx
import { FeatherSearch, FeatherPlus } from "@subframe/core";
```

### Component Usage Examples

**TextField:**
```tsx
<TextField variant="filled" label="Search" icon={<FeatherSearch />}>
  <TextField.Input
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
</TextField>
```

**Button:**
```tsx
<Button
  variant="brand-primary"  // or neutral-secondary, neutral-tertiary, etc.
  size="medium"            // or small, large
  icon={<FeatherPlus />}
  onClick={handleClick}
>
  Create Event
</Button>
```

## Syncing Components in the Future

When you update components in Subframe, sync them to your codebase:

```bash
cd /Users/coleh/rushrank-0.0
npx @subframe/cli sync --all
```

## Available Subframe Components

All components are in `/frontend/ui/components/`:
- TextField, TextArea
- Button, IconButton, LinkButton
- Badge, Alert, Toast
- Table, DropdownMenu, Dialog
- Progress, Slider, Switch
- Checkbox, RadioGroup, Select
- Breadcrumbs, Tabs, Accordion
- And many more...

## Theme Colors Available

You can now use Subframe's theme colors in your Tailwind classes:
- `bg-brand-500`, `text-brand-700`, etc.
- `bg-neutral-100`, `text-neutral-600`, etc.
- `bg-error-500`, `bg-warning-500`, `bg-success-500`
- `text-default-font`, `text-subtext-color`
- `border-neutral-border`

## Font Sizes Available

- `text-caption`, `text-caption-bold`
- `text-body`, `text-body-bold`
- `text-heading-3`, `text-heading-2`, `text-heading-1`

## Next Steps

1. **Export pages from Subframe**: When you want to copy a page design from Subframe:
   - Go to the page in Subframe
   - Click "Code" button to export
   - Copy the React code
   - Paste into your Next.js page file
   - The components will work because they're now properly synced!

2. **Update existing pages**: Your existing pages (like `events/page.tsx`) are already using the correct imports from `@/ui/components/`, so they should work with the synced components.

3. **Customize if needed**: If you need to customize a component, you can add `// @subframe/sync-disable` comment to prevent it from being overwritten on sync.

## Troubleshooting

**Icons not showing?**
- Make sure `@subframe/core` is installed: `npm list @subframe/core`
- Restart your dev server after installing

**Components look wrong?**
- Run `npx @subframe/cli sync --all` to get latest components
- Check that Tailwind config includes `./ui/**/*.{ts,tsx}` in content paths

**Type errors?**
- Make sure TypeScript can find the components
- Check your `tsconfig.json` paths include `@/ui/*`

---

**You're all set!** Cursor should now be able to properly work with your Subframe designs. 🎉

