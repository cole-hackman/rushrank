# 🖼️ Supabase Storage Setup for PNM Photos

## The Error You Hit

```
Intake failed: The related resource does not exist
```

**Cause:** The `pnm-photos` storage bucket doesn't exist in your Supabase project yet.

---

## ✅ Quick Fix (2 Options)

### **Option 1: Create Bucket via Supabase Dashboard** (Easiest)

1. Go to your Supabase project: https://app.supabase.com
2. Click **Storage** in the left sidebar
3. Click **New Bucket**
4. Enter:
   - **Name:** `pnm-photos`
   - **Public bucket:** ✅ Yes (so photos are accessible)
   - **File size limit:** `5 MB`
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
5. Click **Create bucket**
6. Click the new bucket → **Policies** tab → **New Policy**
7. Choose **For full customization** → **Get started**
8. Add these 4 policies:

**Policy 1: Allow Upload**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pnm-photos');
```

**Policy 2: Allow Public Read**
```sql
CREATE POLICY "Public can read PNM photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pnm-photos');
```

**Policy 3: Allow Update**
```sql
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pnm-photos');
```

**Policy 4: Allow Delete**
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pnm-photos');
```

---

### **Option 2: Create via SQL** (Faster)

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the contents of `supabase/storage_setup.sql`
3. Click **Run**

---

## 🧪 Verify It Works

After creating the bucket:

```bash
# Test the storage health check
curl http://localhost:8000/health/storage
```

Expected response:
```json
{
  "ok": true,
  "bucket_exists": true,
  "signed_upload_supported": true,
  "signed_upload_ok": true
}
```

---

## 🔄 Try Adding a PNM Again

1. Go to: http://localhost:3000/intake
2. Fill out the form
3. Add a photo
4. Click "Add PNM"

Should now work! ✅

---

## 🐛 Still Getting Errors?

### "Supabase not configured"
**Fix:** Make sure these env vars are set:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### "403 Forbidden" on upload
**Fix:** Check RLS policies are created (see Option 1 above)

### "Row Level Security" blocking uploads
**Fix:** Temporarily disable RLS on storage.objects:
```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
-- Not recommended for production!
```

Better: Fix your RLS policies to allow authenticated users.

---

## 📸 How Photo Upload Works

```
Frontend (Intake Form)
  ↓
1. POST /api/pnms → Create PNM record
  ↓
2. POST /api/pnms/upload-url → Get signed upload URL
  ↓
3. PUT to Supabase Storage → Upload photo
  ↓
4. PUT /api/pnms/:id → Update PNM with photo_url
```

The signed URL allows direct upload to Supabase without going through your API.

---

## 💡 Alternative: Skip Photo Upload (Temporary)

If you just want to test other features, you can skip photo upload:

1. Go to `/intake`
2. Fill out the form
3. **Don't select a photo**
4. Click "Add PNM"

This will create the PNM without a photo, and everything else will work.

---

## ✅ Final Checklist

- [ ] `pnm-photos` bucket exists in Supabase
- [ ] Bucket is set to **Public**
- [ ] 4 RLS policies created
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Health check passes: `curl http://localhost:8000/health/storage`
- [ ] Can upload photos via `/intake`

---

**Once the bucket is created, photo uploads will work perfectly!** 📸

