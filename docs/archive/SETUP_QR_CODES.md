# QR Code Email Setup - Quick Start

## Prerequisites
- ✅ Mailerlite API key (you have this)
- ✅ Database URL (you have this)
- Supabase project access

## Step 1: Run Database Migration

Apply the migration to add `qr_code_url` column:

**Option A: Using Supabase CLI**
```bash
cd /Users/coleh/rushrank-0.0
npx supabase db push
```

**Option B: Using psql directly**
```bash
psql "postgresql://postgres.xzlgutaygqaoasfmznen:cysQu4-nuhjij-caxdyk@aws-1-us-east-2.pooler.supabase.com:5432/postgres" -f supabase/migrations/0003_add_qr_code_url.sql
```

**Option C: Via Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `supabase/migrations/0003_add_qr_code_url.sql`
4. Paste and run

## Step 2: Create Storage Bucket

**Via Supabase Dashboard (Recommended):**
1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name: `qr-codes`
4. Make it **Public**
5. Click **Create**

**Or via SQL:**
1. Go to **SQL Editor** in Supabase dashboard
2. Copy contents of `supabase/qr_codes_storage_setup.sql`
3. Paste and run

## Step 3: Set Environment Variables

Add to your `.env` file in the project root:

```bash
MAILERLITE_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYTRiYTQ3YTNlYTJlYTE2MDg0NDNjODMxY2JkMzAzOTBiZTJlNDc5OWQyZWY0M2JlNTI1MTg0ZmRiZTVlMGI4NDA2NjEyM2QwZGE0YmM3ZmEiLCJpYXQiOjE3NjQxMTIxMzguMTU3ODYsIm5iZiI6MTc2NDExMjEzOC4xNTc4NjIsImV4cCI6NDkxOTc4NTczOC4xNTQxMSwic3ViIjoiMTk2MTk2NiIsInNjb3BlcyI6W119.WYQp9YBAHtUv1svfKUXkT1DQJJsaIcpneskONzka5614GyiU7TUQrKNOn3Nf7mhl6XTCX3un1dz2QlIFjIZa9EWaQNJatyWE0nD9R26C5VGskzRoAMHt9kvOZI-HOAKjfffG3Hm-xXrF88sPNlTNcGxazDo7hcUIk-yT6EhudyMTA_D1rHNIVL4UWy2YheJ4l-Kuq0zn1WGe9-VAtD5lRrRxjsdYE_ko883d8wBDEpT4G3dBESQVjQ7jJz0XelI1HbB1PEU1HUkMsoKhkB-FJHMmhp9Vh1dmX1oYPdSvXjS7sfda-1Gpvmrpob6RhNKwE85ya7xJRsolNHnsR2uuLwWecYPDpuZki2U9ddqbXD90ZN9C5LzbhLqh9UyUsxPjnJWYGm_rhe3XspPBY5zTzmq04T664sgsAjUOtH79Nq8Bf-jfpFHIu6jTWwV_sIJXH4nMbj_X2bQd0o_4H2eO1-tt-mE0litUqySvufSokhKsL5KN886Na7XOw5t_6By2df_h3YmpF51Z-UVr8pu6OmfG9vQcF80OnSvZvCx2V6RZR-HoPFtp0n8shhJLFuVgipkH_aHfp8aj8V5kkqT5DGf9k09GiBVEv2SC0KYutDakaonJoNlyL6jEHnipcbjqhKbOOVG_4WuSjLJpvpMEklVtuYkjs0pmcXIIFpq67gE

# Optional: Mailerlite group ID for automation
# MAILERLITE_GROUP_ID=123456
```

## Step 4: Install Python Dependencies

```bash
cd /Users/coleh/rushrank-0.0
source venv/bin/activate  # or your virtual environment
pip install -r python_server/requirements.txt
```

## Step 5: Set Up Mailerlite (See MAILERLITE_SETUP.md)

Follow the detailed guide in `MAILERLITE_SETUP.md` to:
1. Create custom field `qr_code_url` in Mailerlite
2. Create a group for PNMs (optional)
3. Set up automation to send emails when subscribers are added

## Step 6: Test

1. Start your backend server
2. Create a test PNM via the intake form or API
3. Check:
   - QR code is generated and uploaded to Supabase Storage
   - Subscriber is added to Mailerlite
   - Email is sent (if automation is set up)

## Verification Checklist

- [ ] Database migration applied (`qr_code_url` column exists)
- [ ] Storage bucket `qr-codes` created and public
- [ ] Environment variables set
- [ ] Python dependencies installed
- [ ] Mailerlite custom field `qr_code_url` created
- [ ] Mailerlite automation set up (optional but recommended)
- [ ] Test PNM creation works
- [ ] QR code appears in Supabase Storage
- [ ] Subscriber added to Mailerlite
- [ ] Email received with QR code

## Troubleshooting

### QR Code Not Generated
- Check Supabase credentials in environment
- Verify storage bucket exists and is public
- Check server logs for errors

### Email Not Sent
- Verify Mailerlite API key is correct
- Check if automation is activated in Mailerlite
- Review server logs for API errors
- Verify subscriber was added to Mailerlite

### QR Code Not in Email
- Ensure custom field `qr_code_url` exists in Mailerlite
- Check email template uses `{{ subscriber.qr_code_url }}`
- Verify QR code URL is publicly accessible

