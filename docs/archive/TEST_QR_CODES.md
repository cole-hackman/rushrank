# Testing QR Code Email System

## Pre-Test Checklist

Before testing, verify:

- [x] Database migration applied (`qr_code_url` column exists)
- [x] Storage bucket `qr-codes` created and public
- [x] Mailerlite custom field `qr_code_url` created
- [x] Mailerlite automation set up and **ACTIVATED**
- [x] Environment variables set in `.env` file
- [ ] Python dependencies installed (check below)

## Verify Dependencies

Run this to check if qrcode is installed:
```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
pip list | grep qrcode
```

If not installed, run:
```bash
pip install -r python_server/requirements.txt
```

## Test Steps

### 1. Start Your Backend Server

```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
python run_fastapi.py
# Or: uvicorn python_server.main:app --reload
```

Keep this running in Terminal 1.

### 2. Start Your Frontend (if testing via UI)

```bash
cd /Users/coleh/rushrank-0.0/frontend
npm run dev
```

Keep this running in Terminal 2.

### 3. Create a Test PNM

**Option A: Via Intake Form (Recommended)**
1. Go to: http://localhost:3000/intake
2. Fill out the form with:
   - Name: "Test QR User"
   - Email: **Use your real email** (to receive the QR code email)
   - Other required fields
3. Submit the form

**Option B: Via API**
```bash
curl -X POST http://localhost:8000/api/pnms?chapter_id=YOUR_CHAPTER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test QR User",
    "email": "your-email@example.com",
    "phone": "555-1234",
    "major": "Computer Science"
  }'
```

### 4. Verify QR Code Generation

**Check Supabase Storage:**
1. Go to Supabase Dashboard → Storage → `qr-codes` bucket
2. You should see a PNG file named with the PNM ID (UUID)
3. Click on it to verify the QR code image

**Check Database:**
1. Go to Supabase Dashboard → Table Editor → `pnms`
2. Find your test PNM
3. Check that `qr_code_url` column has a URL value

**Check Server Logs:**
Look for messages like:
```
INFO: QR code uploaded: https://...
INFO: Subscriber created/updated for test@example.com
```

### 5. Verify Mailerlite Integration

**Check Subscriber:**
1. Go to Mailerlite Dashboard → Subscribers
2. Find the test email address
3. Click on the subscriber
4. Check custom fields - `qr_code_url` should be populated with the URL

**Check Email:**
1. Check your email inbox (and spam folder)
2. You should receive an email with the QR code
3. Verify the QR code image displays correctly

### 6. Test QR Code Scanning

**Option A: Via Check-In Page**
1. Create a test event (if you don't have one)
2. Go to: http://localhost:3000/events/[event-id]/checkin
3. Click the QR button to open scanner
4. Scan the QR code from the email (or from Supabase Storage)
5. Verify PNM is checked in successfully

**Option B: Test QR Code URL**
1. Open the QR code image from Supabase Storage
2. Scan it with any QR code scanner app
3. It should open: `https://rushrank.app/checkin?p={pnm_id}`
4. The URL should contain the PNM ID

## Troubleshooting

### QR Code Not Generated
- Check server logs for errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in `.env`
- Check that storage bucket `qr-codes` exists and is public
- Verify Python dependencies are installed

### Subscriber Not Added to Mailerlite
- Check server logs for API errors
- Verify `MAILERLITE_API_KEY` is correct in `.env`
- Check Mailerlite API key permissions
- Look for error messages in logs

### Email Not Received
- Verify Mailerlite automation is **ACTIVATED** (not just saved)
- Check Mailerlite → Automation → Logs
- Verify subscriber was added successfully
- Check spam/junk folder
- Verify sender email is verified in Mailerlite

### QR Code Not in Email
- Verify custom field `qr_code_url` exists in Mailerlite
- Check email template uses: `{{ subscriber.qr_code_url }}`
- Test QR code URL directly in browser (should show image)
- Verify storage bucket is public

### QR Code Scan Not Working
- Verify QR code contains URL format: `https://rushrank.app/checkin?p={id}`
- Check that PNM ID in URL matches the created PNM
- Verify check-in page is loading correctly
- Check browser console for errors

## Success Criteria

✅ QR code PNG appears in Supabase Storage `qr-codes` bucket  
✅ `qr_code_url` column populated in database  
✅ Subscriber added to Mailerlite with `qr_code_url` field  
✅ Email received with QR code image  
✅ QR code scans correctly and contains proper URL  
✅ Scanning QR code at check-in page successfully checks in PNM  

## Next Steps After Testing

Once everything works:
1. Test with a real PNM (not just test data)
2. Verify QR codes work at an actual event
3. Monitor Mailerlite automation logs
4. Consider adding error notifications/alerts

