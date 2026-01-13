# Mailerlite Setup Guide for QR Code Emails

## Overview
This guide will help you set up Mailerlite to automatically send QR code emails when PNMs are created.

## Step 1: Create Custom Field for QR Code URL

1. Log in to your Mailerlite account
2. Go to **Subscribers** → **Fields**
3. Click **Add custom field**
4. Create a field:
   - **Name**: `qr_code_url`
   - **Type**: Text
   - **Visibility**: Hidden (optional)
5. Save the field

## Step 2: Create a Group for PNMs (Optional but Recommended)

1. Go to **Subscribers** → **Groups**
2. Click **Create group**
3. Name it: "Rush PNMs" or similar
4. Copy the **Group ID** (you'll see it in the URL or group settings)
5. Add to your `.env` file:
   ```
   MAILERLITE_GROUP_ID=your_group_id_here
   ```

## Step 3: Create Email Template

1. Go to **Campaigns** → **Email templates**
2. Click **Create template** → **Custom HTML**
3. Design your email template with:
   - Welcome message
   - QR code image using the custom field: `{{ subscriber.qr_code_url }}`
   - Instructions for using the QR code
4. Save the template

## Step 4: Set Up Automation (Recommended Method)

1. Go to **Automation** → **Create workflow**
2. Choose **Trigger**: "Subscriber joins group"
3. Select your PNM group (created in Step 2)
4. Add action: **Send email**
5. Select the template you created in Step 3
6. Configure:
   - Subject line: "Your RushRank QR Code"
   - From name: "RushRank" or "Beta Theta Pi"
   - From email: Your verified sender email
7. **Activate** the automation

## Step 5: Test the Integration

1. Create a test PNM in RushRank
2. Check Mailerlite → **Subscribers** to verify the subscriber was added
3. Check the subscriber's custom fields to see if `qr_code_url` is populated
4. Verify the automation triggered and email was sent
5. Check the email to ensure QR code displays correctly

## Alternative: Manual Campaign Sending

If you prefer not to use automation, you can manually send campaigns:

1. Create a campaign in Mailerlite
2. Use the template with QR code field
3. Send to the PNM group when needed

However, automation is recommended for automatic sending when PNMs are created.

## Troubleshooting

### QR Code Not Showing in Email
- Verify the `qr_code_url` custom field exists in Mailerlite
- Check that the field name matches exactly: `qr_code_url`
- Ensure the QR code URL is publicly accessible (Supabase Storage bucket is public)
- Test the QR code URL directly in a browser

### Subscriber Not Added
- Verify `MAILERLITE_API_KEY` is set correctly in `.env`
- Check API key permissions in Mailerlite
- Review server logs for API errors

### Automation Not Triggering
- Verify the group ID matches in automation settings
- Ensure automation is **Activated** (not just saved)
- Check automation logs in Mailerlite dashboard

### Email Not Received
- Check spam/junk folder
- Verify sender email is verified in Mailerlite
- Check Mailerlite sending limits/quota
- Review automation logs for errors

## Environment Variables

Add these to your `.env` file:

```bash
MAILERLITE_API_KEY=your_api_key_here
MAILERLITE_GROUP_ID=your_group_id_here  # Optional but recommended
```

## Next Steps

1. Run database migration: `npx supabase db push` or apply `0003_add_qr_code_url.sql`
2. Set up storage bucket: Run `supabase/qr_codes_storage_setup.sql` in Supabase SQL Editor
3. Test creating a PNM and verify email is sent

