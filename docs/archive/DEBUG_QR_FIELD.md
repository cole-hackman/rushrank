# Debugging QR Code URL in Email

## The Problem

The email template uses `{{ subscriber.qr_code_url }}` but it's showing as empty/missing. This means the custom field isn't being populated when the subscriber is added.

## Most Likely Causes

### 1. Custom Field Doesn't Exist or Name Mismatch

The field name must match **exactly** (case-sensitive):
- ✅ Correct: `qr_code_url`
- ❌ Wrong: `qr-code-url`, `qrCodeUrl`, `QR_CODE_URL`, etc.

**Check:**
1. Go to Mailerlite → Subscribers → Fields
2. Look for a field named exactly: `qr_code_url`
3. If it doesn't exist, create it:
   - Name: `qr_code_url` (exact match)
   - Type: **Text**
   - Save

### 2. Field Type is Wrong

The field must be type **Text**, not:
- Number
- Date
- Dropdown
- etc.

### 3. Field Not Being Sent in API Call

Check your backend logs when creating a PNM. You should see:
```
INFO: Request payload: {'email': '...', 'fields': {'name': '...', 'qr_code_url': 'https://...'}}
```

If `qr_code_url` is missing from the payload, that's the issue.

### 4. Mailerlite API Not Accepting the Field

Sometimes Mailerlite silently ignores fields that don't exist. Check the response in logs:
```
INFO: Fields in response: ['name', 'email', ...]
```

If `qr_code_url` is not in the response fields list, Mailerlite didn't accept it.

## How to Fix

### Step 1: Verify Field Exists

1. Go to Mailerlite → Subscribers → Fields
2. Find or create: `qr_code_url` (Text type)
3. Note the exact spelling/casing

### Step 2: Check Backend Logs

When you create a PNM, look for:
```
INFO: Request payload: {...}
INFO: Fields in response: [...]
```

This will tell you:
- What we're sending
- What Mailerlite is accepting

### Step 3: Test with Manual Update

You can manually test by updating a subscriber via API:
```bash
curl -X PUT "https://connect.mailerlite.com/api/subscribers/your-email@example.com" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "qr_code_url": "https://test-url.com/qr.png"
    }
  }'
```

Then check if the field is populated in Mailerlite dashboard.

### Step 4: Verify in Mailerlite Dashboard

1. Go to Mailerlite → Subscribers
2. Find your test subscriber
3. Click on them
4. Check custom fields section
5. See if `qr_code_url` has a value

## Quick Test

Create a new test PNM and watch the backend logs. Look for:
- `Request payload:` - Should include `qr_code_url`
- `Fields in response:` - Should include `qr_code_url` in the list
- Any warnings about the field not being found

## Alternative: Use Different Field Name

If `qr_code_url` isn't working, you could:
1. Create a field with a different name (e.g., `qr_code`)
2. Update the code to use that name
3. Update your email template to use the new field name

But first, let's verify the field exists and is being sent correctly.

