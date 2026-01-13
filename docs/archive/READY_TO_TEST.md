# ✅ Ready to Test QR Code Email System!

## Pre-Flight Checklist

You've completed:
- ✅ Database migration applied
- ✅ Storage bucket `qr-codes` created
- ✅ Mailerlite setup completed
- ✅ QRCode library installed
- ✅ Environment variables configured

## Quick Test Guide

### Step 1: Start Your Backend

```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python run_fastapi.py
```

Keep this terminal open. You should see the server start on `http://localhost:8000`

### Step 2: Create a Test PNM

**Via Intake Form (Easiest):**
1. Open: http://localhost:3000/intake
2. Fill out the form:
   - **Name**: "Test QR Code"
   - **Email**: **Use YOUR real email** (so you can receive the QR code)
   - Fill in other required fields
3. Submit

**What to Watch:**
- Check the backend terminal for logs like:
  ```
  INFO: QR code uploaded: https://...
  INFO: Subscriber created/updated for your-email@example.com
  ```

### Step 3: Verify Everything Worked

**Check 1: Supabase Storage**
- Go to Supabase Dashboard → Storage → `qr-codes` bucket
- You should see a PNG file (named with UUID)
- Click it to see the QR code

**Check 2: Mailerlite**
- Go to Mailerlite → Subscribers
- Find your test email
- Click on the subscriber
- Check that `qr_code_url` custom field has a URL

**Check 3: Your Email**
- Check your inbox (and spam folder)
- You should receive an email with the QR code
- The QR code image should display

**Check 4: Test QR Code Scanning**
1. Open the QR code from the email (or Supabase Storage)
2. Scan it with your phone's camera or a QR scanner app
3. It should show: `https://rushrank.app/checkin?p={some-uuid}`
4. That UUID should match your test PNM's ID

### Step 4: Test Check-In (Optional)

1. Create a test event in your system
2. Go to the check-in page for that event
3. Use the QR scanner to scan the code from the email
4. Verify the PNM gets checked in

## Troubleshooting

### If QR Code Not Generated:
- Check backend logs for errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Make sure storage bucket is public

### If Email Not Received:
- **Most Common Issue**: Mailerlite automation not activated
  - Go to Mailerlite → Automation
  - Find your automation workflow
  - Make sure it's **ACTIVATED** (green toggle, not just saved)
- Check Mailerlite → Automation → Logs for errors
- Verify subscriber was added to Mailerlite
- Check spam folder

### If QR Code Not in Email:
- Verify custom field `qr_code_url` exists in Mailerlite
- Check email template uses: `{{ subscriber.qr_code_url }}`
- Test the QR code URL directly in browser

## Success Indicators

You'll know it's working when:
1. ✅ QR code PNG appears in Supabase Storage
2. ✅ Subscriber appears in Mailerlite with `qr_code_url` field
3. ✅ Email arrives with QR code image
4. ✅ QR code scans to show the check-in URL

## Need Help?

Check the detailed guides:
- `TEST_QR_CODES.md` - Full testing guide
- `MAILERLITE_SETUP.md` - Mailerlite configuration
- `SETUP_QR_CODES.md` - Complete setup reference

---

**You're ready! Go create a test PNM and see the magic happen! 🎉**

