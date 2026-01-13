# ✅ QR Code Email Setup - Status

## What's Been Done

### ✅ Code Implementation
- QR code generation library added (`qrcode[pil]`)
- QR code generation function implemented
- Email sending via Mailerlite integrated
- Database migration created and **RUN SUCCESSFULLY**
- QR scanner updated to parse URL format
- Storage bucket setup SQL created

### ✅ Database
- Migration `0003_add_qr_code_url.sql` has been applied
- `qr_code_url` column now exists in `pnms` table

### ✅ Environment Variables
- `MAILERLITE_API_KEY` is set and working
- `DATABASE_URL` is configured

## What You Need to Do Next

### 1. Set Up Supabase Storage Bucket (5 minutes)

**Option A: Via Supabase Dashboard (Easiest)**
1. Go to your Supabase project dashboard
2. Click **Storage** in the left sidebar
3. Click **New bucket**
4. Enter:
   - **Name**: `qr-codes`
   - **Public bucket**: ✅ Yes
   - **File size limit**: `1 MB`
   - **Allowed MIME types**: `image/png, image/jpeg`
5. Click **Create bucket**

**Option B: Via SQL**
1. Go to **SQL Editor** in Supabase dashboard
2. Copy contents of `supabase/qr_codes_storage_setup.sql`
3. Paste and run

### 2. Set Up Mailerlite (10-15 minutes)

Follow the detailed guide in `MAILERLITE_SETUP.md`. Quick summary:

1. **Create Custom Field**:
   - Go to Mailerlite → Subscribers → Fields
   - Add field: `qr_code_url` (Text type)

2. **Create Group (Optional but Recommended)**:
   - Go to Subscribers → Groups
   - Create group: "Rush PNMs"
   - Copy the Group ID
   - Add to `.env`: `MAILERLITE_GROUP_ID=your_group_id`

3. **Create Email Template**:
   - Go to Campaigns → Email templates
   - Create template with QR code: `<img src="{{ subscriber.qr_code_url }}" alt="QR Code">`

4. **Set Up Automation**:
   - Go to Automation → Create workflow
   - Trigger: "Subscriber joins group" (your PNM group)
   - Action: "Send email" (use your template)
   - **Activate** the automation

### 3. Add Environment Variables to .env File

Make sure your `.env` file in the project root has:

```bash
DATABASE_URL=postgresql://postgres.xzlgutaygqaoasfmznen:cysQu4-nuhjij-caxdyk@aws-1-us-east-2.pooler.supabase.com:5432/postgres
MAILERLITE_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYTRiYTQ3YTNlYTJlYTE2MDg0NDNjODMxY2JkMzAzOTBiZTJlNDc5OWQyZWY0M2JlNTI1MTg0ZmRiZTVlMGI4NDA2NjEyM2QwZGE0YmM3ZmEiLCJpYXQiOjE3NjQxMTIxMzguMTU3ODYsIm5iZiI6MTc2NDExMjEzOC4xNTc4NjIsImV4cCI6NDkxOTc4NTczOC4xNTQxMSwic3ViIjoiMTk2MTk2NiIsInNjb3BlcyI6W119.WYQp9YBAHtUv1svfKUXkT1DQJJsaIcpneskONzka5614GyiU7TUQrKNOn3Nf7mhl6XTCX3un1dz2QlIFjIZa9EWaQNJatyWE0nD9R26C5VGskzRoAMHt9kvOZI-HOAKjfffG3Hm-xXrF88sPNlTNcGxazDo7hcUIk-yT6EhudyMTA_D1rHNIVL4UWy2YheJ4l-Kuq0zn1WGe9-VAtD5lRrRxjsdYE_ko883d8wBDEpT4G3dBESQVjQ7jJz0XelI1HbB1PEU1HUkMsoKhkB-FJHMmhp9Vh1dmX1oYPdSvXjS7sfda-1Gpvmrpob6RhNKwE85ya7xJRsolNHnsR2uuLwWecYPDpuZki2U9ddqbXD90ZN9C5LzbhLqh9UyUsxPjnJWYGm_rhe3XspPBY5zTzmq04T664sgsAjUOtH79Nq8Bf-jfpFHIu6jTWwV_sIJXH4nMbj_X2bQd0o_4H2eO1-tt-mE0litUqySvufSokhKsL5KN886Na7XOw5t_6By2df_h3YmpF51Z-UVr8pu6OmfG9vQcF80OnSvZvCx2V6RZR-HoPFtp0n8shhJLFuVgipkH_aHfp8aj8V5kkqT5DGf9k09GiBVEv2SC0KYutDakaonJoNlyL6jEHnipcbjqhKbOOVG_4WuSjLJpvpMEklVtuYkjs0pmcXIIFpq67gE

# Optional: For automation triggers
# MAILERLITE_GROUP_ID=your_group_id_here
```

### 4. Install Python Dependencies

```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate
pip install -r python_server/requirements.txt
```

This will install `qrcode[pil]` if not already installed.

### 5. Test the System

1. **Start your backend server**
2. **Create a test PNM** via the intake form or API
3. **Verify**:
   - Check Supabase Storage → `qr-codes` bucket for the QR code image
   - Check Mailerlite → Subscribers to see the new subscriber
   - Check the subscriber's custom fields for `qr_code_url`
   - If automation is set up, check email inbox for the QR code email

## How It Works

1. **PNM Creation**: When a PNM is created via the intake form or API:
   - QR code is generated with URL: `https://rushrank.app/checkin?p={pnm_id}`
   - QR code PNG is uploaded to Supabase Storage
   - QR code URL is stored in database
   - Subscriber is added to Mailerlite with `qr_code_url` custom field
   - Mailerlite automation triggers (if set up) and sends email

2. **Event Check-In**: At events:
   - Open check-in page on phone
   - Scan QR code from PNM's email
   - QR code contains PNM ID
   - PNM is automatically checked in

## Troubleshooting

### QR Code Not Generated
- Check server logs for errors
- Verify Supabase credentials are in `.env`
- Ensure storage bucket `qr-codes` exists and is public

### Email Not Sent
- Verify Mailerlite automation is **Activated** (not just saved)
- Check Mailerlite → Automation → Logs for errors
- Verify subscriber was added to Mailerlite
- Check that custom field `qr_code_url` exists in Mailerlite

### QR Code Not in Email
- Ensure email template uses: `<img src="{{ subscriber.qr_code_url }}">`
- Verify QR code URL is publicly accessible (test in browser)
- Check custom field name matches exactly: `qr_code_url`

## Files Created/Modified

- ✅ `python_server/requirements.txt` - Added qrcode library
- ✅ `python_server/services.py` - QR generation and email sending
- ✅ `python_server/routes.py` - QR code endpoint
- ✅ `frontend/app/(dashboard)/events/[id]/checkin/page.tsx` - Updated scanner
- ✅ `supabase/migrations/0003_add_qr_code_url.sql` - Database migration (APPLIED)
- ✅ `supabase/qr_codes_storage_setup.sql` - Storage setup SQL
- ✅ `MAILERLITE_SETUP.md` - Detailed Mailerlite guide
- ✅ `SETUP_QR_CODES.md` - Quick start guide

## Next Steps Summary

1. ✅ Database migration - **DONE**
2. ⏳ Create storage bucket - **DO THIS NEXT**
3. ⏳ Set up Mailerlite - **FOLLOW MAILERLITE_SETUP.md**
4. ⏳ Test with a real PNM

You're almost there! Just need to set up the storage bucket and Mailerlite automation.

