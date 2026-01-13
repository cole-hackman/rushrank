# Fix: Get Your Mailerlite Group ID

## The Problem

You set `MAILERLITE_GROUP_ID=RushPNMs` (the group name), but Mailerlite requires the **numeric ID**, not the name.

## How to Get Your Group ID

### Method 1: From Group URL (Easiest)

1. Go to Mailerlite → **Subscribers** → **Groups**
2. Click on your group "RushPNMs"
3. Look at the URL in your browser
4. You'll see something like: `https://dashboard.mailerlite.com/groups/123456789`
5. The number at the end (`123456789`) is your Group ID

### Method 2: From Group Settings

1. Go to Mailerlite → **Subscribers** → **Groups**
2. Click on "RushPNMs"
3. Look for "Group ID" in the group details/settings
4. Copy that number

### Method 3: Via API (If you want to verify)

Run this to list all your groups:
```bash
curl -X GET "https://connect.mailerlite.com/api/groups" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

Look for your group "RushPNMs" and note its `id` field.

## Update Your .env File

Once you have the numeric ID, update your `.env` file:

```bash
# Change this:
MAILERLITE_GROUP_ID=RushPNMs

# To this (with your actual numeric ID):
MAILERLITE_GROUP_ID=123456789
```

## Restart Your Backend

After updating the `.env` file:
1. Stop your backend (Ctrl+C)
2. Restart it: `./start_backend_clean.sh`

## Test Again

Create another test PNM and you should see:
```
INFO: Adding subscriber to group ID: 123456789
INFO: ✅ Subscriber created/updated for your-email@example.com
```

And the subscriber should be added to the "RushPNMs" group, which will trigger your automation!

## Optional: Remove Group ID

If you don't want to use a group (subscribers will still be added, just not to a specific group), you can:
- Remove `MAILERLITE_GROUP_ID` from your `.env` file, OR
- Set it to an empty value: `MAILERLITE_GROUP_ID=`

The subscriber will still be added to Mailerlite, but you'll need to set up your automation differently (e.g., trigger on "subscriber added" instead of "subscriber joins group").

