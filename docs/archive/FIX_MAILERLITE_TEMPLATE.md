# Fix Mailerlite Email Template - QR Code Not Showing

## The Problem

The QR code URL is correctly set in Mailerlite (`qr_code_url` field has the value), but the email template variable `{{ subscriber.qr_code_url }}` isn't being replaced.

## Solution: Try Different Template Syntax

Mailerlite might use different syntax for custom fields. Try these variations in your email template:

### Option 1: Single Braces (Most Common)
```html
<img src="{subscriber.qr_code_url}" alt="QR Code" />
```

### Option 2: Field Name Only
```html
<img src="{{qr_code_url}}" alt="QR Code" />
```

### Option 3: Without "subscriber" prefix
```html
<img src="{qr_code_url}" alt="QR Code" />
```

### Option 4: Current (Double Braces with subscriber)
```html
<img src="{{ subscriber.qr_code_url }}" alt="QR Code" />
```

## How to Test

1. **Update your email template** in Mailerlite with one of the syntaxes above
2. **Save the template**
3. **Test the automation** by:
   - Creating a new test PNM, OR
   - Manually triggering the automation for an existing subscriber

## Verify Field is Accessible

In Mailerlite:
1. Go to **Campaigns** → **Email templates**
2. Edit your template
3. Look for a **"Fields"** or **"Variables"** button/panel
4. Check if `qr_code_url` appears in the list of available fields
5. If it does, click it to insert the correct syntax

## Alternative: Use Merge Tag

Some Mailerlite versions use merge tags. Try:
- `*|qr_code_url|*` (Mailchimp-style, but Mailerlite might support it)
- Check Mailerlite's template editor for a "Insert Field" or "Merge Tag" option

## Quick Test Template

Replace your QR code section with this to test:

```html
<!-- QR CODE -->
<tr>
  <td align="center" style="padding:10px 22px 4px 22px;">
    <div style="padding:12px;background:#f9fafb;border-radius:12px;display:inline-block;">
      <!-- Try Option 1 first -->
      <img
        src="{subscriber.qr_code_url}"
        alt="Your rush QR code"
        width="260"
        height="260"
        style="display:block;border-radius:8px;width:260px;height:260px;max-width:100%;"
      />
      
      <!-- Fallback: Show the URL as text if image doesn't load -->
      <p style="margin:8px 0 0 0;color:#4b5563;font-size:12px;">
        QR Code URL: {subscriber.qr_code_url}
      </p>
    </div>
  </td>
</tr>
```

If the URL shows as text but the image doesn't, the syntax is working but there's an image loading issue.

## Debug Steps

1. **Check Mailerlite Template Editor**:
   - Look for field insertion tools
   - See what syntax Mailerlite suggests

2. **Test with Plain Text First**:
   - Replace the `<img>` tag temporarily with just: `{subscriber.qr_code_url}`
   - Send a test email
   - If the URL appears, the syntax works, it's just the image tag

3. **Check Mailerlite Documentation**:
   - Go to Mailerlite Help → Email Templates → Variables/Merge Tags
   - Find the correct syntax for custom fields

## Most Likely Fix

Based on common Mailerlite syntax, try **Option 1** first:
```html
<img src="{subscriber.qr_code_url}" alt="QR Code" />
```

(Note: Single braces `{}` instead of double `{{}}`)

