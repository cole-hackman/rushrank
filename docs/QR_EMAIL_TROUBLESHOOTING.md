# QR Code Email Troubleshooting

## How It Works

When you add a PNM, the system:
1. ✅ Generates a QR code and uploads it to Supabase Storage
2. ✅ Downloads the QR code image and converts it to base64
3. ✅ Embeds the QR code directly in the email HTML (no external URL needed)
4. ✅ Adds the PNM as a subscriber to Mailerlite
5. ✅ Sets the `qr_code_url` custom field with the QR code image URL (for automation templates)
6. ✅ Adds the subscriber to the group specified in `MAILERLITE_GROUP_ID`
7. ⚠️ **Relies on a Mailerlite Automation to send the email**

## The Problem

The code **does not send emails directly**. It relies on a **Mailerlite Automation** that must be:
- ✅ Created
- ✅ **ACTIVATED** (not just saved as draft)
- ✅ Configured to trigger when a subscriber joins the group
- ✅ Using the email template with `{{ subscriber.qr_code_url }}` OR a custom HTML template

## QR Code Embedding

**IMPORTANT**: The QR code is now embedded as base64 in the email HTML. This means:
- ✅ QR code will display even if Supabase Storage URL is blocked
- ✅ No external image hosting required
- ✅ Email is self-contained
- ⚠️ However, the automation must use a template that includes the QR code

**Note**: The automation in Mailerlite uses its own template. If your automation template uses `{{ subscriber.qr_code_url }}`, it will work, but the base64-embedded version is more reliable.

## Quick Diagnostic Steps

### 1. Check Server Logs

When you create a PNM, look for these messages in your backend terminal:

**Good signs:**
```
INFO: ✅ Subscriber created/updated for your-email@example.com
INFO: ✅ QR code URL set in Mailerlite: https://...
INFO: ✅ Subscriber added to groups: [172084630866887891]
```

**Problems:**
```
WARNING: ⚠️  QR code URL not found in response!
WARNING: ⚠️  Subscriber not in expected group
WARNING: ⚠️  No group assigned - automation may not trigger
```

### 2. Verify Subscriber in Mailerlite

1. Go to **Mailerlite → Subscribers**
2. Search for the email you used when creating the PNM
3. Click on the subscriber
4. Check:
   - ✅ Subscriber exists
   - ✅ Has the `qr_code_url` field populated
   - ✅ Is in the correct group (ID: 172084630866887891)

### 3. Verify Automation is ACTIVE

**This is the most common issue!**

1. Go to **Mailerlite → Automation**
2. Find your automation workflow (should trigger on "Subscriber joins group")
3. **Check the status**:
   - ✅ Should show **"Active"** with a green toggle
   - ❌ If it says "Draft" or "Paused", click to **ACTIVATE** it

### 4. Check Automation Logs

1. Click on your automation
2. Go to **"Logs"** or **"Activity"** tab
3. Look for entries when you created the PNM
4. Check for any errors

### 5. Verify Email Template

1. Go to **Mailerlite → Automation → Your workflow**
2. Click on the "Send email" action
3. Verify the template uses the `qr_code_url` field directly:
   ```html
   <img src="{$subscriber.qr_code_url}" alt="QR Code">
   ```
   
   **IMPORTANT**: Do NOT construct the URL from `pnm_id`. Use the full `qr_code_url` field directly.
   
   ❌ **WRONG** (what you had):
   ```html
   <img src="https://...supabase.co/.../{$subscriber.pnm_id}.png">
   ```
   
   ✅ **CORRECT**:
   ```html
   <img src="{$subscriber.qr_code_url}">
   ```

## Common Issues & Fixes

### Issue: "QR code URL not found in response"

**Fix:**
1. Go to **Mailerlite → Subscribers → Fields**
2. Create a field named exactly: `qr_code_url` (case-sensitive)
3. Type: **Text**
4. Save

### Issue: "Subscriber not in expected group"

**Fix:**
1. Check your `.env` file has: `MAILERLITE_GROUP_ID=172084630866887891`
2. Verify this group ID exists in Mailerlite
3. Restart your backend server after changing `.env`

### Issue: "Subscriber added but no email sent"

**Most likely causes:**

1. **Automation is not ACTIVE** (most common)
   - Go to **Mailerlite → Automation**
   - Find your automation
   - **ACTIVATE** it (toggle should be green/on)
   - Test by creating a new PNM

2. **Subscriber was already in the group**
   - If the subscriber already existed in Mailerlite and was already in the group, the automation won't trigger
   - **Fix**: Go to Mailerlite → Subscribers → [Your subscriber] → Remove from group, then add the PNM again

3. **Group assignment failed**
   - Check server logs for: `⚠️ Failed to add subscriber to group`
   - Verify `MAILERLITE_GROUP_ID` is set correctly in `.env`
   - Restart backend after changing `.env`

### Issue: "Email sent but QR code doesn't show" or "QR code URL shows as .png"

**Cause**: Template is constructing URL from `pnm_id` instead of using `qr_code_url` field directly.

**Fix:**
1. **Update your Mailerlite email template** to use the `qr_code_url` field directly:
   ```html
   <img src="{$subscriber.qr_code_url}" alt="QR Code">
   ```
   
   Do NOT use:
   ```html
   <img src="https://.../{$subscriber.pnm_id}.png">
   ```
   
   The `pnm_id` field may not be populated or may be empty, causing the URL to break.

2. Verify the `qr_code_url` field is populated in Mailerlite:
   - Go to Mailerlite → Subscribers → [Your subscriber]
   - Check that `qr_code_url` has a full URL like: `https://...supabase.co/.../abc123.png`

3. Test the QR code URL directly in browser (should show image)

4. Verify Supabase Storage bucket `qr-codes` is public

**See `MAILERLITE_TEMPLATE_FIXED.html` for a complete working template.**

## Testing

After fixing issues, test by:
1. Creating a new test PNM with your email
2. Check server logs for success messages
3. Check Mailerlite → Subscribers to verify subscriber was added
4. Check Mailerlite → Automation → Logs to see if automation triggered
5. Check your email inbox (and spam folder)

## Environment Variables

Make sure your `.env` file has:
```bash
MAILERLITE_API_KEY=your_api_key_here
MAILERLITE_GROUP_ID=172084630866887891
```

## Still Not Working?

1. **Check server logs** - Look for error messages
2. **Check Mailerlite dashboard**:
   - Subscriber exists?
   - Has `qr_code_url` field?
   - In correct group?
   - Automation is ACTIVE?
3. **Test automation manually**:
   - In Mailerlite, manually trigger the automation for a test subscriber
   - See if email sends
4. **Check automation settings**:
   - Trigger is "Subscriber joins group"?
   - Group matches `MAILERLITE_GROUP_ID`?
   - Email template is correct?
