# Debugging Mailerlite Integration

## Issue: QR Code Generated but No Email/Subscriber in Mailerlite

### Step 1: Check Server Logs

When you create a PNM, look for these log messages in your backend terminal:

**Good signs:**
```
INFO: QR code uploaded: https://...
INFO: Attempting to send QR email to your-email@example.com with QR URL: https://...
INFO: ✅ Subscriber created/updated for your-email@example.com
```

**Problems to look for:**
```
WARNING: MAILERLITE_API_KEY not set, skipping email
WARNING: ⚠️  QR code URL not found in response. Custom field 'qr_code_url' may not exist in Mailerlite.
ERROR: ❌ Failed to create/update subscriber: 422
```

### Step 2: Verify Custom Field Exists

The most common issue is the custom field `qr_code_url` doesn't exist in Mailerlite.

**Check:**
1. Go to Mailerlite → Subscribers → Fields
2. Look for a field named exactly: `qr_code_url`
3. If it doesn't exist, create it:
   - Click "Add custom field"
   - Name: `qr_code_url` (exact match, case-sensitive)
   - Type: Text
   - Save

### Step 3: Verify Subscriber Was Added

1. Go to Mailerlite → Subscribers
2. Search for the email you used when creating the PNM
3. Click on the subscriber
4. Check the custom fields section
5. Look for `qr_code_url` - it should have the Supabase Storage URL

**If subscriber doesn't exist:**
- Check server logs for errors
- Verify `MAILERLITE_API_KEY` is correct
- Test API connection (run `python test_mailerlite.py`)

### Step 4: Verify Automation is Set Up

**Critical:** The automation must be **ACTIVATED**, not just saved!

1. Go to Mailerlite → Automation
2. Find your automation workflow
3. Check the status - it should say **"Active"** or have a green toggle
4. If it says "Draft" or "Paused", click to activate it

**Check Automation Logs:**
1. Click on your automation
2. Go to "Logs" or "Activity"
3. Look for entries when you created the PNM
4. Check for any errors

### Step 5: Test the Integration

Run the test script:
```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python test_mailerlite.py
```

This will:
- Test API connection
- Try to add a test subscriber
- Show you exactly what's happening

### Common Issues & Fixes

#### Issue: "Custom field doesn't exist"
**Fix:** Create the `qr_code_url` field in Mailerlite → Subscribers → Fields

#### Issue: "Subscriber not added"
**Fix:** 
- Check API key is correct
- Verify API key has proper permissions
- Check server logs for specific error

#### Issue: "Subscriber added but no email"
**Fix:**
- Verify automation is **ACTIVATED** (not just saved)
- Check automation trigger matches (group, field, etc.)
- Verify email template uses `{{ subscriber.qr_code_url }}`
- Check automation logs for errors

#### Issue: "Email sent but no QR code image"
**Fix:**
- Verify email template has: `<img src="{{ subscriber.qr_code_url }}" alt="QR Code">`
- Test the QR code URL directly in browser (should show image)
- Verify storage bucket is public
- Check that `qr_code_url` field is populated in subscriber

### Quick Diagnostic Commands

**Check if subscriber exists:**
```bash
# Look in Mailerlite dashboard → Subscribers
# Search for the email you used
```

**Check server logs:**
```bash
# Look at your backend terminal output
# Search for "QR email" or "Subscriber"
```

**Test API directly:**
```bash
python test_mailerlite.py
```

### Next Steps

1. Create a new test PNM and watch the server logs
2. Copy the log output and check:
   - Is the subscriber being added?
   - Is the QR code URL being set?
   - Are there any errors?
3. Check Mailerlite dashboard:
   - Is the subscriber there?
   - Does it have the `qr_code_url` field?
   - Is the automation active?
4. Check automation logs in Mailerlite

