"""
Business logic services for RushRank
"""
import asyncpg
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
import secrets
import string
import logging
import re
import json

from .database import get_db
from .models import *
from io import StringIO, BytesIO
import csv
from PIL import Image, ImageDraw
import os
import httpx
from supabase import create_client
import qrcode

logger = logging.getLogger(__name__)

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

class UserService:
    """User management service"""
    
    async def get_user_profile(self, user_id: str) -> UserProfile:
        """Get user profile with memberships"""
        db = get_db()
        
        # Get user info
        user_query = "SELECT id, email, created_at FROM users WHERE id = $1"
        user = await db.execute_one(user_query, user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get memberships
        membership_query = """
            SELECT m.id, m.role, m.created_at, c.id as chapter_id, c.name as chapter_name
            FROM memberships m
            JOIN chapters c ON c.id = m.chapter_id
            WHERE m.user_id = $1
        """
        memberships = await db.execute_query(membership_query, user_id)
        
        membership_data = [
            {
                "id": str(m["id"]),
                "role": m["role"],
                "chapter_id": str(m["chapter_id"]),
                "chapter_name": m["chapter_name"],
                "created_at": m["created_at"]
            }
            for m in memberships
        ]
        
        return UserProfile(
            user_id=str(user["id"]),
            email=user["email"],
            memberships=membership_data
        )

class ChapterService:
    """Chapter management service"""
    
    async def get_user_chapters(self, user_id: str) -> List[Chapter]:
        """Get chapters where user is a member"""
        db = get_db()
        logger = logging.getLogger(__name__)
        
        query = """
            SELECT c.id, c.name, c.domain_allowlist, c.created_at
            FROM chapters c
            JOIN memberships m ON m.chapter_id = c.id
            WHERE m.user_id = $1
        """
        
        logger.debug(f"Querying chapters for user_id={user_id}")
        rows = await db.execute_query(query, user_id)
        logger.debug(f"Found {len(rows)} chapters for user_id={user_id}")
        
        return [
            Chapter(
                id=str(row["id"]),
                name=row["name"],
                domain_allowlist=row["domain_allowlist"] or [],
                created_at=row["created_at"]
            )
            for row in rows
        ]
    
    async def create_chapter(self, chapter_data: ChapterCreate, creator_id: str) -> Chapter:
        """Create new chapter and add creator as admin"""
        db = get_db()
        
        # Create chapter
        chapter_query = """
            INSERT INTO chapters (name, domain_allowlist)
            VALUES ($1, $2)
            RETURNING id, name, domain_allowlist, created_at
        """
        
        chapter = await db.execute_one(
            chapter_query, 
            chapter_data.name, 
            chapter_data.domain_allowlist or []
        )
        
        # Add creator as admin
        membership_query = """
            INSERT INTO memberships (user_id, chapter_id, role)
            VALUES ($1, $2, 'admin')
        """
        
        await db.execute_command(membership_query, creator_id, chapter["id"])
        
        return Chapter(
            id=str(chapter["id"]),
            name=chapter["name"],
            domain_allowlist=chapter["domain_allowlist"] or [],
            created_at=chapter["created_at"]
        )
    
    async def verify_membership(self, user_id: str, chapter_id: str):
        """Verify user is a member of the chapter"""
        db = get_db()
        logger = logging.getLogger(__name__)
        
        query = """
            SELECT 1 FROM memberships
            WHERE user_id = $1 AND chapter_id = $2
        """
        
        logger.debug(f"Verifying membership: user_id={user_id}, chapter_id={chapter_id}")
        result = await db.execute_one(query, user_id, chapter_id)
        
        if not result:
            logger.warning(f"Membership verification failed: user_id={user_id}, chapter_id={chapter_id}")
            raise HTTPException(status_code=403, detail="Access denied: You are not a member of this chapter")
    
    async def verify_admin_access(self, user_id: str, chapter_id: str):
        """Verify user is an admin of the chapter"""
        db = get_db()

        query = """
            SELECT 1 FROM memberships
            WHERE user_id = $1 AND chapter_id = $2 AND role = 'admin'
        """

        result = await db.execute_one(query, user_id, chapter_id)

        if not result:
            raise HTTPException(status_code=403, detail="Admin access required")

    async def get_theme(self, chapter_id: str) -> dict:
        """Return chapters.theme JSONB for a chapter."""
        db = get_db()
        row = await db.execute_one(
            "SELECT theme FROM chapters WHERE id = $1", chapter_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Chapter not found")
        theme = row["theme"]
        # asyncpg may return JSONB as dict or as JSON string depending on codec setup
        if isinstance(theme, str):
            theme = json.loads(theme)
        return dict(theme)

    async def update_theme(self, chapter_id: str, user_id: str, patch: dict) -> dict:
        """Admin-only: validate + persist new theme."""
        await self.verify_admin_access(user_id, chapter_id)  # raises 403
        accent = patch.get("accent_hex")
        if accent is not None and not _HEX_RE.match(accent):
            raise ValueError(f"Invalid accent_hex: {accent!r} (must be #RRGGBB)")
        source = patch.get("source", "manual")
        if source not in ("auto", "manual"):
            raise ValueError(f"Invalid source: {source!r}")
        new_theme = {
            "enabled": bool(patch.get("enabled", False)),
            "accent_hex": accent,
            "source": source,
        }
        db = get_db()
        await db.execute_command(
            "UPDATE chapters SET theme = $1::jsonb WHERE id = $2",
            json.dumps(new_theme), chapter_id,
        )
        return new_theme

    async def autodetect_accent(self, fraternity_name: str) -> Optional[str]:
        """Case-insensitive lookup against fraternity_colors with FIJI alias map."""
        from .fraternity_colors_seed import ALIASES
        normalized = fraternity_name.strip().lower()
        canonical = ALIASES.get(normalized, fraternity_name).strip()
        db = get_db()
        row = await db.execute_one(
            "SELECT hex_primary FROM fraternity_colors WHERE lower(name) = lower($1)",
            canonical,
        )
        return row["hex_primary"] if row else None

    async def list_fraternity_colors(self) -> list[dict]:
        """List 30 fraternity colors for signup wizard / autodetect UI."""
        db = get_db()
        rows = await db.execute_query(
            "SELECT key, name, hex_primary FROM fraternity_colors ORDER BY rank"
        )
        return [dict(r) for r in rows]

    async def get_user_chapter_id(self, user_id: str) -> str:
        """Return the (first) chapter the user is a member of."""
        db = get_db()
        row = await db.execute_one(
            "SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1",
            user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="No chapter membership found")
        return str(row["chapter_id"])

    async def get_user_role(self, chapter_id: str, user_id: str) -> Optional[str]:
        """Return 'admin' / 'exec' / 'member' / None if not a member."""
        db = get_db()
        row = await db.execute_one(
            "SELECT role FROM memberships WHERE chapter_id = $1 AND user_id = $2",
            chapter_id, user_id,
        )
        return row["role"] if row else None

    async def get_chapter(self, chapter_id: str) -> Optional[dict]:
        """Return raw chapter row as dict, or None."""
        db = get_db()
        row = await db.execute_one(
            "SELECT id, name, domain_allowlist, created_at FROM chapters WHERE id = $1",
            chapter_id,
        )
        return dict(row) if row else None

    async def provision_chapter(
        self,
        user_id: str,
        fraternity_name: str,
        school: str,
        chapter_name: str,
        admin_name: str,
    ) -> dict:
        """Idempotently create a chapter + admin membership for a user.

        Looks up the fraternity in `fraternity_colors` to pre-seed `theme.accent_hex`
        with source='auto', enabled=False. Caller flips enabled=True in Settings.
        """
        accent = await self.autodetect_accent(fraternity_name)
        theme = {
            "enabled": False,
            "accent_hex": accent,
            "source": "auto" if accent else "manual",
        }
        db = get_db()
        # Idempotency: same user + chapter_name + school → return existing chapter
        existing = await db.execute_one(
            """SELECT c.id FROM chapters c
               JOIN memberships m ON m.chapter_id = c.id
               WHERE m.user_id = $1 AND c.name = $2 AND c.school = $3""",
            user_id, chapter_name, school,
        )
        if existing:
            return {"chapter_id": str(existing["id"])}
        row = await db.execute_one(
            """INSERT INTO chapters (name, fraternity, school, theme)
               VALUES ($1, $2, $3, $4::jsonb)
               RETURNING id""",
            chapter_name, fraternity_name, school, json.dumps(theme),
        )
        chapter_id = row["id"]
        await db.execute_command(
            """INSERT INTO memberships (user_id, chapter_id, role)
               VALUES ($1, $2, 'admin')""",
            user_id, chapter_id,
        )
        return {"chapter_id": str(chapter_id)}

class PNMService:
    """PNM management service"""
    
    async def get_pnm_by_email(self, email: str) -> Optional[PNM]:
        """Get PNM by email (case-insensitive)"""
        db = get_db()
        
        # Using simple query to find latest PNM with this email
        # Ideally emails are unique per chapter, but might duplicate across chapters
        # We'll take the most recently created one
        query = """
            SELECT p.id, p.chapter_id, p.name, p.email, p.phone, p.major, p.hometown, p.year, p.photo_url, p.fun_fact,
                   COALESCE(ARRAY(
                       SELECT t.label FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), ARRAY[]::text[]) AS tags,
                   p.created_at, p.archived
            FROM pnms p
            WHERE LOWER(p.email) = LOWER($1)
            ORDER BY p.created_at DESC
            LIMIT 1
        """
        row = await db.execute_one(query, email)
        
        if not row:
            return None
            
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            email=row["email"],
            phone=row["phone"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=row["tags"] or [],
            walkout_song=None,
            weirdest_talent=None,
            fun_fact=row.get("fun_fact"),
            chick_fil_a_order=None,
            created_at=row["created_at"],
            archived=row["archived"]
        )

    def get_qr_bytes(self, pnm_id: str) -> bytes:
        """Generate QR code bytes for PNM"""
        # Generate QR code with URL
        qr_url = f"https://kiosk.rushrank.app/checkin?p={pnm_id}"
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        
        # Create QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    async def generate_qr_code(self, pnm_id: str) -> Optional[str]:
        """Generate QR code for PNM and upload to Supabase Storage"""
        try:
            # Generate QR code with URL
            qr_url = f"https://rushrank.app/checkin?p={pnm_id}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_url)
            qr.make(fit=True)
            
            # Create QR code image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to bytes
            buf = BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            
            # Upload to Supabase Storage
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            
            if not supabase_url or not supabase_key:
                logger.warning("Supabase not configured, skipping QR code upload")
                return None
            
            client = create_client(supabase_url, supabase_key)
            
            # Ensure bucket exists (create if needed)
            try:
                buckets = client.storage.list_buckets()
                bucket_exists = any(b.get("name") == "qr-codes" for b in buckets or [])
                
                if not bucket_exists:
                    # Try to create bucket (may fail if no permissions, that's ok)
                    try:
                        client.storage.create_bucket("qr-codes", {"public": True})
                        logger.info("Created qr-codes bucket")
                    except Exception as e:
                        logger.warning(f"Could not create qr-codes bucket: {e}")
            except Exception as e:
                logger.warning(f"Could not check/create bucket: {e}")
            
            # Upload QR code
            file_path = f"{pnm_id}.png"
            result = client.storage.from_("qr-codes").upload(file_path, buf.read(), file_options={"content-type": "image/png", "upsert": "true"})
            
            if result:
                # Get public URL
                public_url = f"{supabase_url}/storage/v1/object/public/qr-codes/{file_path}"
                logger.info(f"QR code uploaded: {public_url}")
                return public_url
            else:
                logger.error("Failed to upload QR code")
                return None
                
        except Exception as e:
            logger.error(f"Error generating QR code: {e}", exc_info=True)
            return None
    
    async def send_qr_email(self, pnm: PNM, qr_code_url: Optional[str]) -> bool:
        """Send QR code email to PNM via Mailerlite with embedded QR code"""
        if not pnm.email:
            logger.warning(f"No email for PNM {pnm.id}, skipping email")
            return False
        
        api_key = os.getenv("MAILERLITE_API_KEY")
        if not api_key:
            logger.warning("MAILERLITE_API_KEY not set, skipping email")
            return False
        
        logger.info(f"Attempting to send QR email to {pnm.email} with QR URL: {qr_code_url}")
        
        try:
            # Download QR code image and convert to base64 for embedding
            qr_image_base64 = None
            if qr_code_url:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        qr_response = await client.get(qr_code_url)
                        if qr_response.status_code == 200:
                            import base64
                            qr_image_base64 = base64.b64encode(qr_response.content).decode('utf-8')
                            logger.info(f"✅ QR code downloaded and converted to base64 ({len(qr_image_base64)} chars)")
                        else:
                            logger.warning(f"⚠️  Failed to download QR code: HTTP {qr_response.status_code}")
                except Exception as e:
                    logger.warning(f"⚠️  Error downloading QR code image: {e}")
                    # Continue without embedded image - will use URL fallback
            
            # Build HTML email template with embedded QR code
            if qr_image_base64:
                # Embed QR code as base64 data URI
                qr_image_html = f'''
                <div style="padding:12px;background:#f9fafb;border-radius:12px;display:inline-block;margin:20px auto;">
                    <img src="data:image/png;base64,{qr_image_base64}" 
                         alt="Your rush QR code" 
                         width="260" 
                         height="260" 
                         style="display:block;border-radius:8px;width:260px;height:260px;max-width:100%;" />
                </div>
                '''
                # Also include URL as fallback
                qr_fallback_html = f'''
                <p style="margin:12px 0 0 0;color:#4b5563;font-size:14px;">
                    If the image doesn't load, you can also open this link:<br />
                    <a href="{qr_code_url}" style="color:#013068;text-decoration:underline;word-break:break-all;">{qr_code_url}</a>
                </p>
                '''
            elif qr_code_url:
                # Fallback to URL if base64 embedding failed
                qr_image_html = f'''
                <div style="padding:12px;background:#f9fafb;border-radius:12px;display:inline-block;margin:20px auto;">
                    <img src="{qr_code_url}" 
                         alt="Your rush QR code" 
                         width="260" 
                         height="260" 
                         style="display:block;border-radius:8px;width:260px;height:260px;max-width:100%;" />
                </div>
                '''
                qr_fallback_html = ""
            else:
                qr_image_html = ""
                qr_fallback_html = ""
            
            html_content = f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Your RushRank QR Code</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>

  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

    <!-- OUTER WRAPPER -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <!-- MAIN CARD -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background-color:#ffffff;border-radius:14px;overflow:hidden;">

            <!-- HEADER -->
            <tr>
              <td align="center" style="background-color:#013068;padding:24px 18px;">
                <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">
                  Your RushRank QR Code
                </h1>
                <p style="margin:4px 0 0 0;font-size:14px;color:#ffffff;opacity:0.85;">
                  Your chapter
                </p>
              </td>
            </tr>

            <!-- WELCOME COPY -->
            <tr>
              <td style="padding:20px 22px 12px 22px;color:#111827;font-size:15px;line-height:1.5;">
                <p style="margin:0 0 8px 0;">
                  Hi {pnm.name},
                </p>
                <p style="margin:0 0 12px 0;color:#4b5563;">
                  Thanks for coming out to rush! We'll scan this code at each event to check you in quickly.
                </p>
              </td>
            </tr>

            <!-- QR CODE -->
            <tr>
              <td align="center" style="padding:10px 22px 4px 22px;">
                {qr_image_html}
              </td>
            </tr>

            <!-- BACKUP LINK -->
            {qr_fallback_html and f'<tr><td style="padding:16px 22px 4px 22px;">{qr_fallback_html}</td></tr>' or ''}

            <!-- INSTRUCTIONS -->
            <tr>
              <td style="padding:6px 22px 18px 22px;color:#111827;font-size:14px;line-height:1.5;">
                <p style="margin:0 0 8px 0;">
                  • Save this email or screenshot the QR code.<br />
                  • Bring it to every rush event for quick check-in.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:18px 22px 24px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
                <p style="margin:0 0 4px 0;">
                  Questions? Contact at <strong>hackman@calpoly.edu</strong> or DM on Instagram
                  <span style="color:#013068">@betacalpoly</span>.
                </p>
                <p style="margin:8px 0 0 0;color:#9ca3af;">
                  You're receiving this because you signed up as a PNM for your chapter.
                </p>
              </td>
            </tr>

          </table>
          <!-- END MAIN CARD -->

        </td>
      </tr>
    </table>

  </body>
</html>
            """
            
            base_url = "https://connect.mailerlite.com/api"
            
            # Get group ID from environment (optional - for automation triggers)
            group_id = os.getenv("MAILERLITE_GROUP_ID")  # Optional: specific group for PNMs (must be numeric ID, not name)
            
            # Build subscriber data with custom fields for QR code
            subscriber_data = {
                "email": pnm.email,
                "fields": {
                    "name": pnm.name,
                    "pnm_id": pnm.id  # Useful for constructing direct Supabase URLs in template
                },
                "status": "active"
            }
            
            logger.info(f"debug_mailerlite_payload: {subscriber_data}")

            # Add QR code URL as a custom field if available
            # Note: You'll need to create a custom field "qr_code_url" in Mailerlite first
            if qr_code_url:
                subscriber_data["fields"]["qr_code_url"] = qr_code_url
            
            # Add to group if specified (group_id must be numeric, not name)
            if group_id:
                try:
                    # Try to convert to int (group IDs are numeric)
                    numeric_group_id = int(group_id)
                    subscriber_data["groups"] = [numeric_group_id]
                    logger.info(f"Adding subscriber to group ID: {numeric_group_id}")
                except ValueError:
                    logger.warning(f"MAILERLITE_GROUP_ID '{group_id}' is not a valid numeric ID. Skipping group assignment.")
                    logger.warning(f"To fix: Get the numeric group ID from Mailerlite → Groups → [Your Group] → Check URL or settings")
                    # Continue without group assignment - subscriber will still be added
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Step 1: Create or update subscriber (without groups first)
                # We'll add to group separately to ensure automation triggers
                subscriber_data_no_groups = subscriber_data.copy()
                subscriber_data_no_groups.pop("groups", None)  # Remove groups for initial create/update
                
                subscriber_response = await client.post(
                    f"{base_url}/subscribers",
                    json=subscriber_data_no_groups,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": f"Bearer {api_key}"
                    }
                )
                
                subscriber_was_new = subscriber_response.status_code in (200, 201)
                if not subscriber_was_new:
                    # Try PUT for update if POST fails (subscriber might already exist)
                    subscriber_response = await client.put(
                        f"{base_url}/subscribers",
                        json=subscriber_data_no_groups,
                        headers={
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "Authorization": f"Bearer {api_key}"
                        }
                    )
                
                if subscriber_response.status_code not in (200, 201, 202):
                    error_text = subscriber_response.text if hasattr(subscriber_response, 'text') else str(subscriber_response.content)
                    logger.error(f"❌ Failed to create/update subscriber: {subscriber_response.status_code}")
                    logger.error(f"   Error response: {error_text}")
                    return False
                
                try:
                    response_data = subscriber_response.json()
                except:
                    response_data = {}
                
                logger.info(f"✅ Subscriber created/updated for {pnm.email}")
                logger.info(f"   Response status: {subscriber_response.status_code}")
                logger.info(f"   Subscriber was {'NEW' if subscriber_was_new else 'EXISTING'}")
                
                subscriber_info = response_data.get('data', response_data) if isinstance(response_data, dict) else {}
                if isinstance(subscriber_info, dict):
                    logger.info(f"   Subscriber ID: {subscriber_info.get('id', 'N/A')}")
                    
                    # Log if QR code URL was set
                    if qr_code_url:
                        subscriber_fields = subscriber_info.get('fields', {})
                        field_keys = list(subscriber_fields.keys()) if isinstance(subscriber_fields, dict) else []
                        logger.info(f"   Fields in response: {field_keys}")
                        
                        if subscriber_fields.get('qr_code_url'):
                            logger.info(f"   ✅ QR code URL set in Mailerlite: {subscriber_fields.get('qr_code_url')[:50]}...")
                        else:
                            logger.warning(f"   ⚠️  QR code URL not found in Mailerlite response!")
                            logger.warning(f"   ⚠️  This means the custom field 'qr_code_url' may not exist in Mailerlite")
                            logger.warning(f"   ⚠️  Fix: Go to Mailerlite → Subscribers → Fields → Add field 'qr_code_url' (Text type)")
                
                # Step 2: Add subscriber to group (separate API call to ensure automation triggers)
                # This is critical - adding to group separately triggers "subscriber joins group" automation
                if group_id:
                    try:
                        numeric_group_id = int(group_id)
                        logger.info(f"📌 Adding subscriber to group ID: {numeric_group_id} (separate API call to trigger automation)")
                        
                        # Get subscriber ID from the response if available
                        subscriber_id = subscriber_info.get('id') if isinstance(subscriber_info, dict) else None
                        
                        # Try multiple API endpoint formats for adding subscriber to group
                        # Mailerlite API might use different formats depending on version
                        group_add_success = False
                        error_messages = []
                        
                        # Method 1: Using groups endpoint with email
                        try:
                            group_add_response = await client.post(
                                f"{base_url}/groups/{numeric_group_id}/subscribers",
                                json={"email": pnm.email},
                                headers={
                                    "Content-Type": "application/json",
                                    "Accept": "application/json",
                                    "Authorization": f"Bearer {api_key}"
                                }
                            )
                            
                            if group_add_response.status_code in (200, 201, 202):
                                logger.info(f"   ✅ Subscriber successfully added to group {numeric_group_id} (via groups endpoint)")
                                logger.info(f"   ✅ This should trigger the 'subscriber joins group' automation")
                                group_add_success = True
                            elif group_add_response.status_code == 409:  # Conflict - already in group
                                logger.warning(f"   ⚠️  Subscriber already in group {numeric_group_id}")
                                logger.warning(f"   ⚠️  Automation may not trigger if subscriber was already in this group")
                                logger.warning(f"   ⚠️  Try removing subscriber from group in Mailerlite, then add PNM again")
                                group_add_success = True  # Already in group, so technically "success"
                            else:
                                error_text = group_add_response.text if hasattr(group_add_response, 'text') else str(group_add_response.content)
                                error_messages.append(f"Groups endpoint ({group_add_response.status_code}): {error_text}")
                        except Exception as e:
                            error_messages.append(f"Groups endpoint error: {e}")
                        
                        # Method 2: Using subscriber endpoint with group (if Method 1 failed and we have subscriber ID)
                        if not group_add_success and subscriber_id:
                            try:
                                logger.info(f"   🔄 Trying alternative method: subscriber endpoint")
                                subscriber_group_response = await client.post(
                                    f"{base_url}/subscribers/{subscriber_id}/groups/{numeric_group_id}",
                                    headers={
                                        "Content-Type": "application/json",
                                        "Accept": "application/json",
                                        "Authorization": f"Bearer {api_key}"
                                    }
                                )
                                
                                if subscriber_group_response.status_code in (200, 201, 202):
                                    logger.info(f"   ✅ Subscriber successfully added to group {numeric_group_id} (via subscriber endpoint)")
                                    logger.info(f"   ✅ This should trigger the 'subscriber joins group' automation")
                                    group_add_success = True
                                elif subscriber_group_response.status_code == 409:
                                    logger.warning(f"   ⚠️  Subscriber already in group {numeric_group_id}")
                                    group_add_success = True
                                else:
                                    error_text = subscriber_group_response.text if hasattr(subscriber_group_response, 'text') else str(subscriber_group_response.content)
                                    error_messages.append(f"Subscriber endpoint ({subscriber_group_response.status_code}): {error_text}")
                            except Exception as e:
                                error_messages.append(f"Subscriber endpoint error: {e}")
                        
                        # Method 3: Update subscriber with groups array (fallback)
                        if not group_add_success:
                            try:
                                logger.info(f"   🔄 Trying fallback method: update subscriber with groups")
                                update_with_groups = {
                                    "email": pnm.email,
                                    "groups": [numeric_group_id]
                                }
                                update_response = await client.put(
                                    f"{base_url}/subscribers",
                                    json=update_with_groups,
                                    headers={
                                        "Content-Type": "application/json",
                                        "Accept": "application/json",
                                        "Authorization": f"Bearer {api_key}"
                                    }
                                )
                                
                                if update_response.status_code in (200, 201, 202):
                                    logger.info(f"   ✅ Subscriber updated with group {numeric_group_id} (via PUT update)")
                                    # Note: This might not trigger automation, but at least subscriber is in group
                                    group_add_success = True
                                else:
                                    error_text = update_response.text if hasattr(update_response, 'text') else str(update_response.content)
                                    error_messages.append(f"PUT update ({update_response.status_code}): {error_text}")
                            except Exception as e:
                                error_messages.append(f"PUT update error: {e}")
                        
                        if not group_add_success:
                            logger.error(f"   ❌ All methods failed to add subscriber to group {numeric_group_id}")
                            for error_msg in error_messages:
                                logger.error(f"      - {error_msg}")
                            logger.error(f"   ❌ Check Mailerlite API documentation for correct endpoint format")
                            logger.error(f"   ❌ Group ID: {numeric_group_id}, Email: {pnm.email}")
                            
                    except ValueError:
                        logger.warning(f"   ⚠️  Invalid group ID format: {group_id}")
                    except Exception as e:
                        logger.error(f"   ❌ Error adding subscriber to group: {e}", exc_info=True)
                else:
                    logger.warning(f"   ⚠️  No MAILERLITE_GROUP_ID set - automation will not trigger")
                    logger.warning(f"   ⚠️  Set MAILERLITE_GROUP_ID in .env to enable automation")
                
                # Step 3: Summary and final logging
                logger.info(f"ℹ️  Subscriber added to Mailerlite successfully")
                logger.info(f"ℹ️  QR code is embedded in email template (base64) - no external URL needed")
                if group_id:
                    logger.info(f"ℹ️  Email should be sent via automation if configured and activated")
                    logger.info(f"ℹ️  Check Mailerlite → Automation to ensure automation is ACTIVE for this group")
                    logger.info(f"ℹ️  Automation should use custom field 'qr_code_url' in the email template")
                else:
                    logger.warning(f"⚠️  No MAILERLITE_GROUP_ID set - automation will not trigger")
                    logger.warning(f"⚠️  Set MAILERLITE_GROUP_ID in .env to enable automatic email sending")
                
                return True
                    
        except Exception as e:
            logger.error(f"Error sending QR email: {e}", exc_info=True)
            return False
    
    async def get_chapter_pnms(self, chapter_id: str) -> List[PNM]:
        """Get all PNMs for a chapter"""
        db = get_db()
        
        query = """
            SELECT p.id, p.chapter_id, p.name, p.email, p.phone, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE(ARRAY(
                       SELECT t.label FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), ARRAY[]::text[]) AS tags,
                   p.created_at, p.archived
            FROM pnms p
            WHERE p.chapter_id = $1
            ORDER BY p.name
        """
        rows = await db.execute_query(query, chapter_id)
        
        return [
            PNM(
                id=str(row["id"]),
                chapter_id=str(row["chapter_id"]),
                name=row["name"],
                email=row["email"],
                phone=row["phone"],
                major=row["major"],
                hometown=row["hometown"],
                year=row["year"],
                photo_url=row["photo_url"],
                tags=row["tags"] or [],
                walkout_song=None,
                weirdest_talent=None,
                chick_fil_a_order=None,
                created_at=row["created_at"],
                archived=row["archived"]
            )
            for row in rows
        ]
    
    async def get_pnm(self, pnm_id: str) -> Optional[PNM]:
        """Get specific PNM"""
        db = get_db()
        
        query = """
            SELECT p.id, p.chapter_id, p.name, p.email, p.phone, p.major, p.hometown, p.year, p.photo_url, p.fun_fact,
                   COALESCE(ARRAY(
                       SELECT t.label FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), ARRAY[]::text[]) AS tags,
                   p.created_at, p.archived
            FROM pnms p
            WHERE p.id = $1
        """
        row = await db.execute_one(query, pnm_id)
        
        if not row:
            return None
        
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            email=row["email"],
            phone=row["phone"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=row["tags"] or [],
            walkout_song=None,
            weirdest_talent=None,
            fun_fact=row.get("fun_fact"),
            chick_fil_a_order=None,
            created_at=row["created_at"],
            archived=row["archived"]
        )
    
    async def create_pnm(self, pnm_data: PNMCreate, chapter_id: str) -> PNM:
        """Create new PNM"""
        db = get_db()
        
        # Insert into pnms table (only columns that exist in the migration)
        query = """
            INSERT INTO pnms (chapter_id, name, email, phone, major, hometown, year, photo_url, fun_fact)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, chapter_id, name, email, phone, major, hometown, year, photo_url, fun_fact, created_at, archived
        """
        # Validate email is required and not empty
        if not pnm_data.email or not pnm_data.email.strip():
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Normalize optional string fields: strip if present, convert empty strings to None
        email = pnm_data.email.strip()
        phone = pnm_data.phone.strip() if pnm_data.phone and pnm_data.phone.strip() else None
        major = pnm_data.major.strip() if pnm_data.major and pnm_data.major.strip() else None
        hometown = pnm_data.hometown.strip() if pnm_data.hometown and pnm_data.hometown.strip() else None
        year = pnm_data.year.strip() if pnm_data.year and pnm_data.year.strip() else None
        fun_fact = pnm_data.fun_fact.strip() if pnm_data.fun_fact and pnm_data.fun_fact.strip() else None
        
        row = await db.execute_one(
            query,
            chapter_id,
            pnm_data.name,
            email,
            phone,
            major,
            hometown,
            year,
            pnm_data.photo_url,
            fun_fact
        )
        
        pnm_id = str(row["id"])
        
        # Generate QR code and upload to storage
        qr_code_url = None
        try:
            qr_code_url = await self.generate_qr_code(pnm_id)
            
            # Update PNM with QR code URL if we have the column
            if qr_code_url:
                try:
                    update_query = """
                        UPDATE pnms
                        SET qr_code_url = $1
                        WHERE id = $2
                    """
                    await db.execute_command(update_query, qr_code_url, pnm_id)
                except Exception as e:
                    # Column might not exist yet if migration hasn't run
                    logger.warning(f"Could not update qr_code_url (column may not exist): {e}")
        except Exception as e:
            logger.error(f"Error generating QR code for PNM {pnm_id}: {e}", exc_info=True)
        
        # Get tags from junction table if they exist
        tags_query = """
            SELECT t.label
            FROM pnm_tags pt
            JOIN tags t ON t.id = pt.tag_id
            WHERE pt.pnm_id = $1
        """
        tag_rows = await db.execute_query(tags_query, pnm_id)
        tag_labels = [t["label"] for t in tag_rows] if tag_rows else []
        
        # If tags were provided in pnm_data, use them (tags will be added via separate endpoint)
        if pnm_data.tags:
            tag_labels = pnm_data.tags
        
        pnm = PNM(
            id=pnm_id,
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            email=row["email"],
            phone=row["phone"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=tag_labels,
            walkout_song=None,  # These columns don't exist in the migration schema
            weirdest_talent=None,
            fun_fact=row.get("fun_fact"),
            chick_fil_a_order=None,
            created_at=row["created_at"],
            archived=row["archived"]
        )
        
        # Run email and attendance in background (don't block response)
        import asyncio
        
        async def background_tasks():
            # Send QR code email (don't block on failure)
            try:
                await self.send_qr_email(pnm, qr_code_url)
            except Exception as e:
                logger.error(f"Error sending QR email for PNM {pnm_id}: {e}", exc_info=True)
            
            # Auto-log attendance for any events happening today in this chapter
            try:
                from datetime import date as date_type
                today = date_type.today()
                events_today = await db.execute_query("""
                    SELECT id FROM events 
                    WHERE chapter_id = $1 AND DATE(date) = $2 AND is_active = true
                """, chapter_id, today)
                
                if events_today:
                    logger.info(f"Found {len(events_today)} event(s) today - auto-checking in PNM {pnm_id}")
                    for event_row in events_today:
                        try:
                            await db.execute_command("""
                                INSERT INTO event_attendance (event_id, pnm_id, method, notes)
                                VALUES ($1, $2, 'SEARCH', 'Auto-checked in on PNM creation')
                                ON CONFLICT (event_id, pnm_id) DO NOTHING
                            """, str(event_row["id"]), pnm_id)
                            logger.info(f"✅ Auto-checked in PNM {pnm_id} at event {event_row['id']}")
                        except Exception as e:
                            logger.warning(f"Failed to auto-check in for event {event_row['id']}: {e}")
            except Exception as e:
                logger.warning(f"Error checking for same-day events: {e}", exc_info=True)
        
        # Fire and forget - don't await
        asyncio.create_task(background_tasks())
        
        return pnm
    
    async def update_pnm(self, pnm_id: str, pnm_data: PNMCreate) -> PNM:
        """Update PNM"""
        db = get_db()
        
        # Normalize optional string fields: strip if present, convert empty strings to None
        email = pnm_data.email.strip() if pnm_data.email and pnm_data.email.strip() else None
        phone = pnm_data.phone.strip() if pnm_data.phone and pnm_data.phone.strip() else None
        major = pnm_data.major.strip() if pnm_data.major and pnm_data.major.strip() else None
        hometown = pnm_data.hometown.strip() if pnm_data.hometown and pnm_data.hometown.strip() else None
        year = pnm_data.year.strip() if pnm_data.year and pnm_data.year.strip() else None
        
        # Update only columns that exist in the migration schema
        query = """
            UPDATE pnms
            SET name = $2, email = $3, phone = $4, major = $5, hometown = $6, year = $7, photo_url = $8
            WHERE id = $1
            RETURNING id, chapter_id, name, email, phone, major, hometown, year, photo_url, created_at
        """
        
        row = await db.execute_one(
            query,
            pnm_id,
            pnm_data.name,
            email,
            phone,
            major,
            hometown,
            year,
            pnm_data.photo_url
        )
        
        # Get tags from junction table
        tags_query = """
            SELECT t.label
            FROM pnm_tags pt
            JOIN tags t ON t.id = pt.tag_id
            WHERE pt.pnm_id = $1
        """
        tag_rows = await db.execute_query(tags_query, pnm_id)
        tag_labels = [t["label"] for t in tag_rows] if tag_rows else []
        
        # If tags were provided in pnm_data, use them
        if pnm_data.tags:
            tag_labels = pnm_data.tags
        
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            email=row["email"],
            phone=row["phone"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=tag_labels,
            walkout_song=None,  # These columns don't exist in the migration schema
            weirdest_talent=None,
            fun_fact=pnm_data.fun_fact if hasattr(pnm_data, 'fun_fact') else None,
            chick_fil_a_order=None,
            created_at=row["created_at"]
        )
    
    async def delete_pnm(self, pnm_id: str) -> bool:
        """Delete PNM"""
        db = get_db()
        
        # First delete related records (cascade might not be set up)
        try:
            # Delete tags
            await db.execute_command("DELETE FROM pnm_tags WHERE pnm_id = $1", pnm_id)
            # Delete notes
            await db.execute_command("DELETE FROM pnm_notes WHERE pnm_id = $1", pnm_id)
            # Delete votes
            await db.execute_command("DELETE FROM votes WHERE pnm_id = $1", pnm_id)
            # Delete round_pnms
            await db.execute_command("DELETE FROM round_pnms WHERE pnm_id = $1", pnm_id)
            # Delete attendance
            await db.execute_command("DELETE FROM event_attendance WHERE pnm_id = $1", pnm_id)
        except Exception as e:
            logger.warning(f"Error deleting related records for PNM {pnm_id}: {e}")
        
        # Delete the PNM
        query = "DELETE FROM pnms WHERE id = $1"
        result = await db.execute_command(query, pnm_id)
        
        # Check if deletion was successful
        # asyncpg.execute returns a string like "DELETE 1" or "DELETE 0"
        if isinstance(result, str):
            # Extract the number from "DELETE N"
            import re
            match = re.search(r'DELETE (\d+)', result)
            if match:
                count = int(match.group(1))
                return count > 0
        return False

    async def list_for_export(self, chapter_id: str, *, filters: dict, sort: Optional[str] = None) -> list[dict]:
        """Fetch PNMs with tags + vote summary + latest note for slideshow export.

        Supports optional bid-list filtering. Returns rows shaped for SlideshowService.build_pnm_deck:
        {id, name, year, major, hometown, photo_url, tags, status,
         vote_summary, latest_note, gpa}
        `status` is always 'active' (no schema column for it).
        `gpa` is None (no schema column).
        """
        db = get_db()
        bid_list_id = filters.get("bid_list_id")
        bid_bucket = filters.get("bucket")

        if bid_list_id:
            base = """
              SELECT
                p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                COALESCE(ARRAY(
                  SELECT t.label FROM pnm_tags pt JOIN tags t ON t.id = pt.tag_id
                  WHERE pt.pnm_id = p.id
                ), ARRAY[]::TEXT[]) AS tags,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'YES')   AS up_count,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'NO') AS down_count,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.favorite = true) AS star_count,
                (SELECT n.body FROM pnm_notes n WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_body,
                (SELECT u.email FROM pnm_notes n LEFT JOIN users u ON u.id = n.author_user_id
                   WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_author
              FROM bid_list_entries e
              JOIN pnms p ON p.id = e.pnm_id
              WHERE e.bid_list_id = $1 AND p.chapter_id = $2
                AND COALESCE(p.archived, false) = false
            """
            args: list = [bid_list_id, chapter_id]
            if bid_bucket in ("bid", "maybe", "cut"):
                args.append(bid_bucket)
                base += f" AND e.bucket = ${len(args)}::bid_bucket"
            base += " ORDER BY e.position"
        else:
            base = """
              SELECT
                p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                COALESCE(ARRAY(
                  SELECT t.label FROM pnm_tags pt JOIN tags t ON t.id = pt.tag_id
                  WHERE pt.pnm_id = p.id
                ), ARRAY[]::TEXT[]) AS tags,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'YES')   AS up_count,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'NO') AS down_count,
                (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.favorite = true) AS star_count,
                (SELECT n.body FROM pnm_notes n WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_body,
                (SELECT u.email FROM pnm_notes n LEFT JOIN users u ON u.id = n.author_user_id
                   WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_author
              FROM pnms p
              WHERE p.chapter_id = $1 AND COALESCE(p.archived, false) = false
            """
            args = [chapter_id]
            if filters.get("search"):
                args.append(f"%{filters['search'].lower()}%")
                base += f" AND lower(p.name) LIKE ${len(args)}"
            order = "p.name"
            if sort == "name":
                order = "p.name"
            elif sort == "created":
                order = "p.created_at DESC"
            base += f" ORDER BY {order}"

        rows = await db.execute_query(base, *args)
        result = []
        for r in rows:
            latest_note = None
            if r.get("latest_note_body"):
                latest_note = {
                    "author": r.get("latest_note_author") or "",
                    "text": r["latest_note_body"],
                }
            result.append({
                "id": str(r["id"]),
                "name": r["name"],
                "year": r.get("year") or "",
                "major": r.get("major") or "",
                "hometown": r.get("hometown") or "",
                "photo_url": r.get("photo_url"),
                "tags": list(r.get("tags") or []),
                "status": "active",
                "vote_summary": {
                    "up": int(r.get("up_count") or 0),
                    "down": int(r.get("down_count") or 0),
                    "star": int(r.get("star_count") or 0),
                },
                "latest_note": latest_note,
                "gpa": None,
            })
        return result

class VotingService:
    """Voting management service"""
    
    def _generate_room_code(self) -> str:
        """Generate random 6-character room code"""
        return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    
    async def get_chapter_rounds(self, chapter_id: str) -> List[VotingRound]:
        """Get voting rounds for a chapter"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, type, status, room_code, selected_pnm_ids,
                   started_at, ended_at, created_at
            FROM voting_rounds
            WHERE chapter_id = $1
            ORDER BY created_at DESC
        """
        
        rows = await db.execute_query(query, chapter_id)
        
        result = []
        for row in rows:
            # 0013 normalises type/status to the canonical uppercase vocabulary
            # and constrains them with a CHECK, so these always parse.
            round_type = RoundType(row["type"])
            round_status = RoundStatus(row["status"])

            result.append(
                VotingRound(
                    id=str(row["id"]),
                    chapter_id=str(row["chapter_id"]),
                    type=round_type,
                    status=round_status,
                    room_code=row["room_code"],
                    selected_pnm_ids=row["selected_pnm_ids"] or [],
                    started_at=row["started_at"],
                    ended_at=row["ended_at"],
                    created_at=row["created_at"]
                )
            )
        
        return result
    
    async def get_active_round(self, chapter_id: str) -> Optional[VotingRoundWithDetails]:
        """Get active voting round for a chapter"""
        db = get_db()
        
        query = """
            SELECT vr.id, vr.chapter_id, vr.type, vr.status, vr.room_code, vr.selected_pnm_ids,
                   vr.started_at, vr.ended_at, vr.created_at,
                   COALESCE(array_length(vr.selected_pnm_ids, 1), 0) as total_pnms,
                   COUNT(DISTINCT v.voter_user_id) as voter_count
            FROM voting_rounds vr
            LEFT JOIN votes v ON v.round_id = vr.id
            WHERE vr.chapter_id = $1 AND vr.status = 'ACTIVE'
            GROUP BY vr.id
        """
        
        row = await db.execute_one(query, chapter_id)
        
        if not row:
            return None
        
        round_type = RoundType(row["type"])
        round_status = RoundStatus(row["status"])

        return VotingRoundWithDetails(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            type=round_type,
            status=round_status,
            room_code=row["room_code"],
            selected_pnm_ids=row["selected_pnm_ids"] or [],
            started_at=row["started_at"],
            ended_at=row["ended_at"],
            created_at=row["created_at"],
            total_pnms=row["total_pnms"] or 0,
            voter_count=row["voter_count"] or 0
        )
    
    async def get_round(self, round_id: str) -> Optional[VotingRound]:
        """Get specific voting round"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, type, status, room_code, selected_pnm_ids,
                   started_at, ended_at, created_at
            FROM voting_rounds
            WHERE id = $1
        """
        
        row = await db.execute_one(query, round_id)
        
        if not row:
            return None
        
        round_type = RoundType(row["type"])
        round_status = RoundStatus(row["status"])

        return VotingRound(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            type=round_type,
            status=round_status,
            room_code=row["room_code"],
            selected_pnm_ids=row["selected_pnm_ids"] or [],
            started_at=row["started_at"],
            ended_at=row["ended_at"],
            created_at=row["created_at"]
        )
    
    async def create_round(self, round_data: RoundCreate, chapter_id: str) -> VotingRound:
        """Create new voting round"""
        db = get_db()
        
        # Generate unique room code
        room_code = self._generate_room_code()
        
        # End any existing active rounds
        await db.execute_command(
            "UPDATE voting_rounds SET status = 'ENDED', ended_at = NOW() WHERE chapter_id = $1 AND status = 'ACTIVE'",
            chapter_id
        )
        
        query = """
            INSERT INTO voting_rounds (chapter_id, type, room_code, selected_pnm_ids, status, started_at)
            VALUES ($1, $2, $3, $4, 'ACTIVE', NOW())
            RETURNING id, chapter_id, type, status, room_code, selected_pnm_ids,
                      started_at, ended_at, created_at
        """
        
        row = await db.execute_one(
            query,
            chapter_id,
            round_data.type.value,
            room_code,
            round_data.selected_pnm_ids
        )

        await self.set_round_pnms(str(row["id"]), round_data.selected_pnm_ids)

        return VotingRound(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            type=RoundType(row["type"]),
            status=RoundStatus(row["status"]),
            room_code=row["room_code"],
            selected_pnm_ids=row["selected_pnm_ids"] or [],
            started_at=row["started_at"],
            ended_at=row["ended_at"],
            created_at=row["created_at"]
        )
    
    async def end_round(self, round_id: str) -> bool:
        """End voting round"""
        db = get_db()
        
        query = """
            UPDATE voting_rounds
            SET status = 'ENDED', ended_at = NOW()
            WHERE id = $1
        """
        
        result = await db.execute_command(query, round_id)
        return "UPDATE 1" in result
    
    async def set_round_pnms(self, round_id: str, pnm_ids: List[str]) -> None:
        """Populate round_pnms for a round, preserving order.

        get_round_results and export_round_csv both filter on round_pnms, but no
        code path ever wrote to it -- so every round the application created came
        back with empty results. 0013 backfills existing rows; this keeps new
        ones correct. `voting_rounds.selected_pnm_ids` is still written alongside
        until the contract migration removes it.
        """
        if not pnm_ids:
            return
        db = get_db()
        await db.execute_command(
            """
            INSERT INTO round_pnms (round_id, pnm_id, order_index)
            SELECT $1, x.pnm_id::uuid, (x.ord - 1)::int
            FROM unnest($2::text[]) WITH ORDINALITY AS x(pnm_id, ord)
            WHERE EXISTS (SELECT 1 FROM pnms p WHERE p.id = x.pnm_id::uuid)
            ON CONFLICT (round_id, pnm_id) DO UPDATE SET order_index = EXCLUDED.order_index
            """,
            round_id, [str(pid) for pid in pnm_ids],
        )

    async def cast_vote(self, round_id: str, vote_data: VoteCreate, voter_id: str) -> Vote:
        """Cast or update vote in a round"""
        db = get_db()
        
        # Use UPSERT to handle vote updates
        query = """
            INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (round_id, pnm_id, voter_user_id)
            DO UPDATE SET value = $4, favorite = $5, voted_at = NOW()
            RETURNING id, round_id, pnm_id, voter_user_id, value, favorite, voted_at
        """

        row = await db.execute_one(
            query,
            round_id,
            vote_data.pnm_id,
            voter_id,
            vote_data.value.value,
            vote_data.favorite
        )

        return Vote(
            id=str(row["id"]),
            round_id=str(row["round_id"]),
            pnm_id=str(row["pnm_id"]),
            voter_id=str(row["voter_user_id"]),
            value=row["value"],
            favorite=row["favorite"],
            created_at=row["voted_at"]
        )
    
    async def get_round_results(self, round_id: str) -> List[PNMWithVotes]:
        """Get voting results for a round"""
        db = get_db()
        
        query = """
            SELECT p.id, p.chapter_id, p.name, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE(ARRAY(
                       SELECT t.label FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), ARRAY[]::text[]) AS tags,
                   p.created_at,
                   COUNT(v.id) as vote_count,
                   COUNT(CASE WHEN v.value = 'YES' THEN 1 END) as yes_count,
                   COUNT(CASE WHEN v.value = 'NO' THEN 1 END) as no_count,
                   COUNT(CASE WHEN v.value = 'UNKNOWN' THEN 1 END) as dont_know_count,
                   COUNT(CASE WHEN v.favorite THEN 1 END) as favorite_count,
                   CASE WHEN COUNT(v.id) > 0 THEN
                       ROUND(COUNT(CASE WHEN v.value = 'YES' THEN 1 END) * 100.0 / COUNT(v.id), 2)
                   ELSE 0 END as yes_percentage,
                   -- Population stddev of the YES/UNKNOWN/NO -> 1/0.5/0 mapping,
                   -- scaled so the PRD's ">= 2.0 is controversial" threshold is
                   -- meaningful. Was hardcoded to 0, so nothing was ever flagged.
                   COALESCE(STDDEV_POP(
                       CASE v.value WHEN 'YES' THEN 1.0 WHEN 'UNKNOWN' THEN 0.5 ELSE 0.0 END
                   ), 0) * 20 as controversy_score
            FROM pnms p
            LEFT JOIN votes v ON v.pnm_id = p.id AND v.round_id = $1
            WHERE p.id IN (
                SELECT pnm_id FROM round_pnms WHERE round_id = $1
            )
            GROUP BY p.id, p.chapter_id, p.name, p.major, p.hometown, p.year, p.photo_url, p.created_at
            ORDER BY yes_percentage DESC, vote_count DESC
        """
        
        rows = await db.execute_query(query, round_id)
        
        return [
            PNMWithVotes(
                id=str(row["id"]),
                chapter_id=str(row["chapter_id"]),
                name=row["name"],
                major=row["major"],
                hometown=row["hometown"],
                year=row["year"],
                photo_url=row["photo_url"],
                tags=row["tags"] or [],
                walkout_song=None,
                weirdest_talent=None,
                chick_fil_a_order=None,
                created_at=row["created_at"],
                vote_count=row["vote_count"] or 0,
                yes_count=row["yes_count"] or 0,
                no_count=row["no_count"] or 0,
                dont_know_count=row["dont_know_count"] or 0,
                favorite_count=row["favorite_count"] or 0,
                yes_percentage=float(row["yes_percentage"] or 0),
                controversy_score=float(row["controversy_score"] or 0)
            )
            for row in rows
        ]

class EventService:
    """Event management service"""
    
    async def get_chapter_events(self, chapter_id: str) -> List[Event]:
        """Get events for a chapter with attendance counts"""
        db = get_db()
        logger = logging.getLogger(__name__)
        
        query = """
            SELECT 
                e.id, e.chapter_id, e.name, e.description, e.date, e.type, e.location,
                e.check_in_code, e.is_active, e.created_at,
                COUNT(DISTINCT ea.pnm_id) as attendee_count
            FROM events e
            LEFT JOIN event_attendance ea ON ea.event_id = e.id
            WHERE e.chapter_id = $1 AND e.is_active = true
            GROUP BY e.id, e.chapter_id, e.name, e.description, e.date, e.type, 
                     e.location, e.check_in_code, e.is_active, e.created_at
            ORDER BY e.date
        """
        
        logger.debug(f"Querying events for chapter_id={chapter_id}")
        rows = await db.execute_query(query, chapter_id)
        logger.debug(f"Found {len(rows)} events for chapter_id={chapter_id}")
        
        return [
            Event(
                id=str(row["id"]),
                chapter_id=str(row["chapter_id"]),
                name=row["name"],
                description=row["description"],
                date=row["date"],
                type=EventType(row["type"]),
                location=row["location"],
                check_in_code=row["check_in_code"],
                is_active=row["is_active"],
                created_at=row["created_at"],
                attendee_count=row["attendee_count"] if row["attendee_count"] else 0
            )
            for row in rows
        ]
    
    async def get_event(self, event_id: str) -> Optional[Event]:
        """Get specific event with attendance count"""
        db = get_db()
        
        query = """
            SELECT 
                e.id, e.chapter_id, e.name, e.description, e.date, e.type, e.location,
                e.check_in_code, e.is_active, e.created_at,
                COUNT(DISTINCT ea.pnm_id) as attendee_count
            FROM events e
            LEFT JOIN event_attendance ea ON ea.event_id = e.id
            WHERE e.id = $1
            GROUP BY e.id, e.chapter_id, e.name, e.description, e.date, e.type, 
                     e.location, e.check_in_code, e.is_active, e.created_at
        """
        
        row = await db.execute_one(query, event_id)
        
        if not row:
            return None
        
        return Event(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            description=row["description"],
            date=row["date"],
            type=EventType(row["type"]),
            location=row["location"],
            check_in_code=row["check_in_code"],
            is_active=row["is_active"],
            created_at=row["created_at"],
            attendee_count=row["attendee_count"] if row["attendee_count"] else 0
        )
    
    async def create_event(self, event_data: EventCreate, chapter_id: str) -> Event:
        """Create new event"""
        db = get_db()
        
        query = """
            INSERT INTO events (chapter_id, name, description, date, type, location, check_in_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, chapter_id, name, description, date, type, location,
                      check_in_code, is_active, created_at
        """
        
        row = await db.execute_one(
            query,
            chapter_id,
            event_data.name,
            event_data.description,
            event_data.date,
            event_data.type.value,
            event_data.location,
            event_data.check_in_code
        )
        
        return Event(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            description=row["description"],
            date=row["date"],
            type=EventType(row["type"]),
            location=row["location"],
            check_in_code=row["check_in_code"],
            is_active=row["is_active"],
            created_at=row["created_at"],
            attendee_count=0  # New events have no attendees yet
        )
    
    async def update_event(self, event_id: str, event_data: EventCreate) -> Event:
        """Update an event"""
        db = get_db()
        
        query = """
            UPDATE events
            SET name = $2, description = $3, date = $4, type = $5, location = $6, check_in_code = $7
            WHERE id = $1
            RETURNING id, chapter_id, name, description, date, type, location,
                      check_in_code, is_active, created_at
        """
        
        row = await db.execute_one(
            query,
            event_id,
            event_data.name,
            event_data.description,
            event_data.date,
            event_data.type.value,
            event_data.location,
            event_data.check_in_code
        )
        
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Get attendee count
        attendee_count_query = """
            SELECT COUNT(DISTINCT pnm_id) as attendee_count
            FROM event_attendance
            WHERE event_id = $1
        """
        attendee_row = await db.execute_one(attendee_count_query, event_id)
        attendee_count = attendee_row["attendee_count"] if attendee_row else 0
        
        return Event(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            description=row["description"],
            date=row["date"],
            type=EventType(row["type"]),
            location=row["location"],
            check_in_code=row["check_in_code"],
            is_active=row["is_active"],
            created_at=row["created_at"],
            attendee_count=attendee_count
        )
    
    async def export_attendance_csv(self, chapter_id: str) -> str:
        """Export all event attendance as CSV"""
        db = get_db()
        
        query = """
            SELECT 
                e.name as event_name,
                e.date as event_date,
                e.location,
                p.name as pnm_name,
                p.email as pnm_email,
                p.major,
                a.checked_in_at,
                u.email as checked_in_by_email
            FROM event_attendance a
            JOIN events e ON e.id = a.event_id
            JOIN pnms p ON p.id = a.pnm_id
            LEFT JOIN users u ON u.id = a.checked_in_by_user_id
            WHERE e.chapter_id = $1
            ORDER BY e.date DESC, a.checked_in_at DESC
        """
        
        rows = await db.execute_query(query, chapter_id)
        
        # Generate CSV
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Event Name", "Event Date", "Location", 
            "PNM Name", "PNM Email", "Major",
            "Checked In At", "Checked In By"
        ])
        
        # Rows
        for row in rows:
            writer.writerow([
                row["event_name"] or "",
                row["event_date"].isoformat() if row["event_date"] else "",
                row["location"] or "",
                row["pnm_name"] or "",
                row["pnm_email"] or "",
                row["major"] or "",
                row["checked_in_at"].isoformat() if row["checked_in_at"] else "",
                row["checked_in_by_email"] or "",
            ])
        
        return output.getvalue()
    
    async def delete_event(self, event_id: str) -> bool:
        """Delete an event (soft delete by setting is_active = false)"""
        db = get_db()
        
        query = """
            UPDATE events
            SET is_active = false
            WHERE id = $1
            RETURNING id
        """
        
        row = await db.execute_one(query, event_id)
        return row is not None
    
    async def mark_attendance(self, attendance_data: AttendanceCreate, checker_id: str) -> Attendance:
        """Mark PNM attendance at event"""
        db = get_db()
        
        # Write to event_attendance table (used by PNMs page)
        # Determine method based on notes or default to 'SEARCH'
        method = 'QR' if attendance_data.notes and 'qr' in attendance_data.notes.lower() else 'SEARCH'
        
        event_attendance_query = """
            INSERT INTO event_attendance (event_id, pnm_id, checked_in_by_user_id, method)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, pnm_id) DO NOTHING
            RETURNING event_id, pnm_id, checked_in_at, checked_in_by_user_id
        """
        
        event_row = await db.execute_one(
            event_attendance_query,
            attendance_data.event_id,
            attendance_data.pnm_id,
            checker_id,
            method
        )
        
        if not event_row:
            raise HTTPException(status_code=400, detail="Attendance already marked")
        
        # Return using event_attendance data (primary source)
        return Attendance(
            id=str(event_row["event_id"]) + "_" + str(event_row["pnm_id"]),  # Composite key for compatibility
            event_id=str(event_row["event_id"]),
            pnm_id=str(event_row["pnm_id"]),
            checked_in_at=event_row["checked_in_at"],
            checked_in_by=str(event_row["checked_in_by_user_id"]) if event_row["checked_in_by_user_id"] else None,
            notes=attendance_data.notes
        )

class ExportService:
    """CSV exports and PNM card generation"""
    
    async def export_pnms_csv(self, chapter_id: str) -> str:
        """Export all PNMs as CSV with email and phone"""
        db = get_db()
        query = """
            SELECT p.id, p.name, p.email, p.phone, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE((
                       SELECT string_agg(t.label, ',')
                       FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), '') AS tags,
                   COALESCE((
                       SELECT COUNT(*)
                       FROM event_attendance a
                       JOIN events e ON e.id = a.event_id
                       WHERE a.pnm_id = p.id AND e.is_active = true
                   ), 0) AS attendance_count,
                   p.created_at
            FROM pnms p
            WHERE p.chapter_id = $1
            ORDER BY p.name
        """
        rows = await db.execute_query(query, chapter_id)
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["id","name","email","phone","major","hometown","year","photo_url","tags","attendance_count","created_at"])
        for r in rows:
            writer.writerow([
                str(r["id"]), r["name"], r.get("email") or "", r.get("phone") or "", r["major"], r["hometown"], r["year"],
                r["photo_url"] or "", r["tags"] or "", r["attendance_count"] or 0, r["created_at"]
            ])
        return output.getvalue()
    
    async def export_round_csv(self, round_id: str) -> str:
        """Return CSV text for a round summary"""
        db = get_db()
        query = """
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE((
                       SELECT string_agg(t.label, ',')
                       FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), '') AS tags,
                   COUNT(v.id) as vote_count,
                   COUNT(CASE WHEN v.value = 'YES' THEN 1 END) as yes_count,
                   COUNT(CASE WHEN v.value = 'NO' THEN 1 END) as no_count,
                   COUNT(CASE WHEN v.value = 'UNKNOWN' THEN 1 END) as dont_know_count,
                   COUNT(CASE WHEN v.favorite THEN 1 END) as favorite_count,
                   CASE WHEN COUNT(v.id) > 0 THEN
                       ROUND(COUNT(CASE WHEN v.value = 'YES' THEN 1 END) * 100.0 / COUNT(v.id), 2)
                   ELSE 0 END as yes_percentage
            FROM pnms p
            LEFT JOIN votes v ON v.pnm_id = p.id AND v.round_id = $1
            WHERE p.id IN (SELECT pnm_id FROM round_pnms WHERE round_id = $1)
            GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
            ORDER BY yes_percentage DESC, vote_count DESC
        """
        rows = await db.execute_query(query, round_id)
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "pnm_id","name","major","hometown","year","photo_url","tags",
            "vote_count","yes_count","no_count","dont_know_count","favorite_count","yes_percentage"
        ])
        for r in rows:
            writer.writerow([
                str(r["id"]), r["name"], r["major"], r["hometown"], r["year"],
                r["photo_url"] or "", r["tags"] or "",
                r["vote_count"] or 0, r["yes_count"] or 0, r["no_count"] or 0, r["dont_know_count"] or 0, r["favorite_count"] or 0,
                float(r["yes_percentage"] or 0.0)
            ])
        return output.getvalue()
    
    async def generate_pnm_card(self, pnm_id: str) -> str:
        """Generate a PNM share card image and upload to Supabase Storage. Returns a URL."""
        from .graphics import compose_pnm_card
        
        db = get_db()
        row = await db.execute_one("""
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.fun_fact,
                   COALESCE(ARRAY(
                       SELECT t.label FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), ARRAY[]::text[]) AS tags
            FROM pnms p WHERE p.id = $1
        """, pnm_id)
        if not row:
            raise HTTPException(status_code=404, detail="PNM not found")
        
        # Generate image using graphics service
        image_bytes = await compose_pnm_card(
            name=row["name"],
            hometown=row.get("hometown"),
            major=row.get("major"),
            year=row.get("year"),
            fun_fact=row.get("fun_fact"),
            photo_url=row.get("photo_url"),
            tags=list(row.get("tags") or [])
        )
        
        # Upload to Supabase Storage if configured
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        bucket = os.getenv("SUPABASE_EXPORTS_BUCKET", "exports")
        filename = f"cards/{pnm_id}.png"
        
        if supabase_url and supabase_key:
            # Use PUT method for Supabase Storage uploads
            upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{filename}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "image/png",
                "x-upsert": "true"  # Allow overwriting if file exists
            }
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.put(upload_url, headers=headers, content=image_bytes)
                if r.status_code in (200, 201):
                    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{filename}"
                    return public_url
                else:
                    error_detail = r.text if hasattr(r, 'text') else str(r.status_code)
                    logger.error(f"Supabase upload failed: {r.status_code} - {error_detail}")
                    raise HTTPException(status_code=500, detail=f"Upload failed: {r.status_code} - {error_detail[:200]}")
        else:
            return f"/exports/{filename}"
    
    async def generate_pnm_cards_bulk(self, chapter_id: Optional[str] = None, pnm_ids: Optional[List[str]] = None) -> str:
        """Generate images for multiple PNMs and return ZIP file URL.
        
        Args:
            chapter_id: Generate for all PNMs in chapter
            pnm_ids: Generate for specific PNM IDs (takes precedence over chapter_id)
        
        Returns:
            Public URL to ZIP file in Supabase Storage
        """
        import zipfile
        from datetime import datetime
        from .graphics import compose_pnm_card
        
        db = get_db()
        
        # Build query based on parameters
        if pnm_ids:
            query = """
                SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.fun_fact,
                       COALESCE(ARRAY(
                           SELECT t.label FROM pnm_tags pt
                           JOIN tags t ON t.id = pt.tag_id
                           WHERE pt.pnm_id = p.id
                       ), ARRAY[]::text[]) AS tags
                FROM pnms p
                WHERE p.id = ANY($1::uuid[])
                ORDER BY p.name
            """
            rows = await db.execute_query(query, pnm_ids)
        elif chapter_id:
            query = """
                SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.fun_fact,
                       COALESCE(ARRAY(
                           SELECT t.label FROM pnm_tags pt
                           JOIN tags t ON t.id = pt.tag_id
                           WHERE pt.pnm_id = p.id
                       ), ARRAY[]::text[]) AS tags
                FROM pnms p
                WHERE p.chapter_id = $1
                ORDER BY p.name
            """
            rows = await db.execute_query(query, chapter_id)
        else:
            raise HTTPException(status_code=400, detail="Either chapter_id or pnm_ids required")
        
        if not rows:
            raise HTTPException(status_code=404, detail="No PNMs found")
        
        # Create ZIP file in memory
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for row in rows:
                try:
                    # Generate image
                    image_bytes = await compose_pnm_card(
                        name=row["name"],
                        hometown=row.get("hometown"),
                        major=row.get("major"),
                        year=row.get("year"),
                        fun_fact=row.get("fun_fact"),
                        photo_url=row.get("photo_url"),
                        tags=list(row.get("tags") or [])
                    )
                    
                    # Sanitize filename
                    safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in row["name"])
                    filename = f"{safe_name}_{row['id']}.png"
                    
                    # Add to ZIP
                    zip_file.writestr(filename, image_bytes)
                except Exception as e:
                    logger.warning(f"Failed to generate image for PNM {row['id']}: {e}")
                    continue
        
        zip_buffer.seek(0)
        
        # Upload ZIP to Supabase Storage
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        bucket = os.getenv("SUPABASE_EXPORTS_BUCKET", "exports")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if chapter_id:
            zip_filename = f"pnms_{chapter_id}_{timestamp}.zip"
        else:
            zip_filename = f"pnms_bulk_{timestamp}.zip"
        
        if supabase_url and supabase_key:
            # Use PUT method for Supabase Storage uploads
            upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{zip_filename}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/zip",
                "x-upsert": "true"  # Allow overwriting if file exists
            }
            zip_data = zip_buffer.read()
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.put(upload_url, headers=headers, content=zip_data)
                if r.status_code in (200, 201):
                    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{zip_filename}"
                    return public_url
                else:
                    error_detail = r.text if hasattr(r, 'text') else str(r.status_code)
                    logger.error(f"Supabase upload failed: {r.status_code} - {error_detail}")
                    raise HTTPException(status_code=500, detail=f"Upload failed: {r.status_code} - {error_detail[:200]}")
        else:
            raise HTTPException(status_code=500, detail="Supabase storage not configured")

class NoteService:
    """Notes/comments on PNMs"""
    
    async def list_notes(self, pnm_id: str) -> List[Note]:
        db = get_db()
        rows = await db.execute_query("""
            SELECT n.id, n.pnm_id, n.author_user_id, n.body, n.anonymous,
                   n.likes_count, n.created_at,
                   CASE WHEN n.anonymous THEN NULL ELSE u.email END AS author_email
            FROM pnm_notes n
            LEFT JOIN users u ON u.id = n.author_user_id
            WHERE n.pnm_id = $1
            ORDER BY n.created_at DESC
        """, pnm_id)
        return [
            Note(
                id=str(r["id"]),
                pnm_id=str(r["pnm_id"]),
                author_id=str(r["author_user_id"]) if r["author_user_id"] else None,
                author="Anonymous" if r["anonymous"] else (r["author_email"] or "Member"),
                body=r["body"],
                anonymous=r["anonymous"],
                likes_count=r["likes_count"] or 0,
                created_at=r["created_at"],
            )
            for r in rows
        ]
    
    async def create_note(self, note: NoteCreate, author_id: str) -> Note:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous)
            VALUES ($1, $2, $3, $4)
            RETURNING id, pnm_id, author_user_id, body, anonymous, likes_count, created_at
        """, note.pnm_id, author_id, note.body, note.anonymous)
        return Note(
            id=str(row["id"]),
            pnm_id=str(row["pnm_id"]),
            author_id=str(row["author_user_id"]) if row["author_user_id"] else None,
            body=row["body"],
            anonymous=row["anonymous"],
            likes_count=row["likes_count"] or 0,
            created_at=row["created_at"],
        )
    
    async def delete_note(self, note_id: str) -> bool:
        db = get_db()
        res = await db.execute_command("DELETE FROM pnm_notes WHERE id = $1", note_id)
        return "DELETE 1" in res

class TagService:
    """Tags and PNM tag relations"""
    
    async def list_tags(self, chapter_id: str) -> List[Dict[str, Any]]:
        db = get_db()
        rows = await db.execute_query("""
            SELECT 
                t.id, 
                t.label, 
                t.color, 
                t.chapter_id,
                COUNT(DISTINCT pt.pnm_id) as pnm_count
            FROM tags t
            LEFT JOIN pnm_tags pt ON pt.tag_id = t.id
            WHERE t.chapter_id = $1
            GROUP BY t.id, t.label, t.color, t.chapter_id
            ORDER BY t.label
        """, chapter_id)
        return [
            {
                "id": str(r["id"]),
                "label": r["label"],
                "color": r["color"],
                "chapter_id": str(r["chapter_id"]),
                "pnm_count": r["pnm_count"] or 0,
            }
            for r in rows
        ]
    
    async def create_tag(self, chapter_id: str, label: str, color: Optional[str]) -> Dict[str, Any]:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO tags (chapter_id, label, color)
            VALUES ($1, $2, $3)
            RETURNING id, label, color, chapter_id
        """, chapter_id, label, color)
        return {
            "id": str(row["id"]),
            "label": row["label"],
            "color": row["color"],
            "chapter_id": str(row["chapter_id"]),
        }
    
    async def update_tag(self, tag_id: str, label: str, color: Optional[str]) -> Dict[str, Any]:
        db = get_db()
        row = await db.execute_one("""
            UPDATE tags
            SET label = $2, color = $3
            WHERE id = $1
            RETURNING id, label, color, chapter_id
        """, tag_id, label, color)
        return {
            "id": str(row["id"]),
            "label": row["label"],
            "color": row["color"],
            "chapter_id": str(row["chapter_id"]),
        }
    
    async def delete_tag(self, tag_id: str) -> bool:
        db = get_db()
        res = await db.execute_command("DELETE FROM tags WHERE id = $1", tag_id)
        return "DELETE 1" in res
    
    async def add_tag_to_pnm(self, pnm_id: str, tag_id: str) -> bool:
        db = get_db()
        await db.execute_command("""
            INSERT INTO pnm_tags (pnm_id, tag_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        """, pnm_id, tag_id)
        return True
    
    async def remove_tag_from_pnm(self, pnm_id: str, tag_id: str) -> bool:
        db = get_db()
        res = await db.execute_command("""
            DELETE FROM pnm_tags WHERE pnm_id = $1 AND tag_id = $2
        """, pnm_id, tag_id)
        return "DELETE 1" in res
    
    async def get_tag_statistics(self, chapter_id: str) -> Dict[str, Any]:
        """Get tag usage statistics for a chapter"""
        db = get_db()
        
        # Get total tags count
        total_tags_row = await db.execute_one("""
            SELECT COUNT(*) as count FROM tags WHERE chapter_id = $1
        """, chapter_id)
        total_tags = total_tags_row["count"] if total_tags_row else 0
        
        # Get most used tag
        most_used_row = await db.execute_one("""
            SELECT t.id, t.label, COUNT(pt.pnm_id) as usage_count
            FROM tags t
            LEFT JOIN pnm_tags pt ON pt.tag_id = t.id
            WHERE t.chapter_id = $1
            GROUP BY t.id, t.label
            ORDER BY usage_count DESC, t.label
            LIMIT 1
        """, chapter_id)
        
        most_used_tag = None
        if most_used_row and most_used_row["usage_count"] > 0:
            most_used_tag = {
                "id": str(most_used_row["id"]),
                "label": most_used_row["label"],
                "usage_count": most_used_row["usage_count"]
            }
        
        # Get count of tagged PNMs (PNMs with at least one tag)
        tagged_pnms_row = await db.execute_one("""
            SELECT COUNT(DISTINCT pt.pnm_id) as count
            FROM pnm_tags pt
            JOIN tags t ON t.id = pt.tag_id
            WHERE t.chapter_id = $1
        """, chapter_id)
        tagged_pnms = tagged_pnms_row["count"] if tagged_pnms_row else 0
        
        return {
            "total_tags": total_tags,
            "most_used_tag": most_used_tag,
            "tagged_pnms_count": tagged_pnms
        }

class SessionService:
    """Voting session state (advance/lock)"""
    
    async def set_current(self, round_id: str, current_pnm_id: Optional[str]) -> Dict[str, Any]:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO sessions (round_id, current_pnm_id, locked, started_at)
            VALUES ($1, $2, false, NOW())
            ON CONFLICT (round_id)
            DO UPDATE SET current_pnm_id = EXCLUDED.current_pnm_id
            RETURNING id, round_id, current_pnm_id, locked, started_at, ended_at
        """, round_id, current_pnm_id)
        return {
            "id": str(row["id"]),
            "round_id": str(row["round_id"]),
            "current_pnm_id": str(row["current_pnm_id"]) if row["current_pnm_id"] else None,
            "locked": row["locked"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
        }
    
    async def set_locked(self, round_id: str, locked: bool) -> Dict[str, Any]:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO sessions (round_id, current_pnm_id, locked, started_at)
            VALUES ($1, NULL, $2, NOW())
            ON CONFLICT (round_id)
            DO UPDATE SET locked = EXCLUDED.locked
            RETURNING id, round_id, current_pnm_id, locked, started_at, ended_at
        """, round_id, locked)
        return {
            "id": str(row["id"]),
            "round_id": str(row["round_id"]),
            "current_pnm_id": str(row["current_pnm_id"]) if row["current_pnm_id"] else None,
            "locked": row["locked"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
        }

class UploadService:
    """Signed upload URL for PNM photos"""
    
    async def create_signed_upload_url(self, pnm_id: str, filename: str) -> Dict[str, Any]:
        supabase_url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        client = create_client(supabase_url, key)
        path = f"pnm/{pnm_id}/{filename}"
        try:
            res = client.storage.from_("pnm-photos").create_signed_upload_url(path)
            if not res:
                raise HTTPException(status_code=500, detail="Failed to create signed URL")
            return {"path": path, "signed_url": res.get("signedUrl") or res.get("signed_url") or res}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Signed upload error: {e}")

    async def upload_pnm_photo(self, pnm_id: str, file_bytes: bytes, content_type: str, filename: str) -> str:
        """Upload PNM photo directly via backend (bypasses client CORS)"""
        supabase_url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        
        client = create_client(supabase_url, key)
        path = f"pnm/{pnm_id}/{filename}"
        
        try:
            # Upsert file
            res = client.storage.from_("pnm-photos").upload(
                path, 
                file_bytes, 
                file_options={"content-type": content_type, "upsert": "true"}
            )
            
            # Construct public URL
            public_url = f"{supabase_url}/storage/v1/object/public/pnm-photos/{path}"
            return public_url
            
        except Exception as e:
            logger.error(f"Backend upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

class InvitationService:
    """User invitation service - creates users and sends invitation emails"""
    
    def _generate_password(self, length: int = 16) -> str:
        """Generate a secure random password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    async def invite_user(self, email: str, chapter_id: str, role: str, invited_by_id: str) -> Dict[str, Any]:
        """Invite a user by creating account in Supabase and sending invitation email"""
        db = get_db()
        
        # Normalize email
        email = email.strip().lower()
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        
        # Generate random password
        password = self._generate_password()
        
        user_id = None
        user_created = False
        
        # First, check if user exists in Supabase Auth
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Check if user already exists in Supabase Auth
            get_user_response = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                params={"email": email},
                headers={
                    "Authorization": f"Bearer {supabase_service_key}",
                    "apikey": supabase_service_key
                }
            )
            
            if get_user_response.status_code == 200:
                users_data = get_user_response.json()
                if users_data.get("users") and len(users_data["users"]) > 0:
                    # User exists in Supabase Auth
                    user_id = users_data["users"][0]["id"]
                    logger.info(f"User already exists in Supabase Auth: {user_id}")
                    
                    # Check if they're already a member - if so, this is a re-invitation (update password)
                    # If not, just use existing user without changing password
                    existing_membership_check = await db.execute_one("""
                        SELECT id FROM memberships WHERE user_id = $1 AND chapter_id = $2
                    """, user_id, chapter_id)
                    
                    if existing_membership_check:
                        # Re-inviting existing member - update their password
                        logger.info(f"Re-inviting existing member, updating password for: {user_id}")
                    else:
                        # User exists in Supabase but not a member yet - still set the password
                        # because we're sending it in the invitation email
                        logger.info(f"User exists in Supabase Auth but not a member yet - setting invitation password")
                    
                    # Update password for both cases (re-inviting or new invitation to existing user)
                    update_response = await client.put(
                        f"{supabase_url}/auth/v1/admin/users/{user_id}",
                        json={
                            "password": password,
                            "email_confirm": True
                        },
                        headers={
                            "Authorization": f"Bearer {supabase_service_key}",
                            "Content-Type": "application/json",
                            "apikey": supabase_service_key
                        }
                    )
                    
                    if update_response.status_code not in (200, 201):
                        error_text = update_response.text
                        logger.error(f"Failed to update password for user: {update_response.status_code} - {error_text}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to update user password: {error_text}"
                        )
                    
                    logger.info(f"Password set for user {email}: {user_id}")
                else:
                    # User doesn't exist in Supabase Auth - create them
                    logger.info(f"Creating new user in Supabase Auth: {email}")
                    logger.info(f"Password length: {len(password)}, starts with: {password[:2]}...")
                    
                    # Supabase Admin API format
                    create_payload = {
                        "email": email,
                        "password": password,
                        "email_confirm": True,  # Auto-confirm email so they can log in immediately
                        "user_metadata": {
                            "chapter_id": chapter_id,
                            "role": role
                        }
                    }
                    
                    logger.info(f"Creating user with payload: email={email}, email_confirm=True")
                    
                    create_user_response = await client.post(
                        f"{supabase_url}/auth/v1/admin/users",
                        json=create_payload,
                        headers={
                            "Authorization": f"Bearer {supabase_service_key}",
                            "Content-Type": "application/json",
                            "apikey": supabase_service_key
                        }
                    )
                    
                    response_text = create_user_response.text
                    logger.info(f"Supabase create user response: {create_user_response.status_code}")
                    logger.info(f"Response preview: {response_text[:300]}...")
                    
                    if create_user_response.status_code not in (200, 201):
                        error_text = response_text
                        logger.error(f"❌ Failed to create user in Supabase: {create_user_response.status_code}")
                        logger.error(f"   Error details: {error_text}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to create user in Supabase: {error_text}"
                        )
                    
                    try:
                        user_data = create_user_response.json()
                    except Exception as e:
                        logger.error(f"❌ Failed to parse response as JSON: {e}")
                        logger.error(f"   Response text: {response_text}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Invalid response from Supabase: {response_text[:200]}"
                        )
                    
                    # Supabase Admin API can return user data in different formats
                    user_id = user_data.get("id") or user_data.get("user", {}).get("id")
                    
                    if not user_id:
                        logger.error(f"❌ No user_id in response. Full response: {user_data}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to get user_id from Supabase response. Response: {user_data}"
                        )
                    
                    user_created = True
                    logger.info(f"✅ Created new user in Supabase: {user_id} for {email}")
                    logger.info(f"   User email: {user_data.get('email')}, confirmed: {user_data.get('email_confirmed_at') is not None}")
                    
                    # Verify the user was created and can be retrieved
                    verify_response = await client.get(
                        f"{supabase_url}/auth/v1/admin/users/{user_id}",
                        headers={
                            "Authorization": f"Bearer {supabase_service_key}",
                            "apikey": supabase_service_key
                        }
                    )
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        logger.info(f"✅ Verified user exists in Supabase: {verify_data.get('email')}")
                        logger.info(f"   Email confirmed: {verify_data.get('email_confirmed_at') is not None}")
                        logger.info(f"   User can log in: {verify_data.get('email_confirmed_at') is not None and verify_data.get('banned_until') is None}")
                    else:
                        logger.warning(f"⚠️ Could not verify user creation: {verify_response.status_code} - {verify_response.text[:200]}")
            else:
                # Error checking for user - try to create anyway
                logger.warning(f"Error checking for existing user: {get_user_response.status_code}, attempting to create")
                create_user_response = await client.post(
                    f"{supabase_url}/auth/v1/admin/users",
                    json={
                        "email": email,
                        "password": password,
                        "email_confirm": True,
                        "user_metadata": {
                            "chapter_id": chapter_id,
                            "role": role
                        }
                    },
                    headers={
                        "Authorization": f"Bearer {supabase_service_key}",
                        "Content-Type": "application/json",
                        "apikey": supabase_service_key
                    }
                )
                
                response_text = create_user_response.text
                logger.info(f"Supabase create user response (fallback): {create_user_response.status_code}")
                
                if create_user_response.status_code not in (200, 201):
                    error_text = response_text
                    logger.error(f"❌ Failed to create user in Supabase (fallback): {create_user_response.status_code}")
                    logger.error(f"   Error details: {error_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create user in Supabase: {error_text}"
                    )
                
                try:
                    user_data = create_user_response.json()
                except Exception as e:
                    logger.error(f"❌ Failed to parse response as JSON (fallback): {e}")
                    logger.error(f"   Response text: {response_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Invalid response from Supabase: {response_text[:200]}"
                    )
                
                user_id = user_data.get("id") or user_data.get("user", {}).get("id")
                
                if not user_id:
                    logger.error(f"❌ No user_id in response (fallback). Full response: {user_data}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to get user_id from Supabase response. Response: {user_data}"
                    )
                
                user_created = True
                logger.info(f"✅ Created new user in Supabase (fallback): {user_id} for {email}")
        
        if not user_id:
            raise HTTPException(status_code=500, detail="Failed to get or create user in Supabase Auth")
        
        # Create or update user record in our database
        try:
            await db.execute_command("""
                INSERT INTO users (id, email)
                VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET email = $2
            """, user_id, email)
            logger.info(f"User record created/updated in database: {user_id}")
        except Exception as e:
            logger.error(f"Error creating user record in database: {e}", exc_info=True)
            # Continue anyway - user exists in Supabase Auth
        
        if not user_id:
            raise HTTPException(status_code=500, detail="Failed to get user ID")
        
        # Memberships table uses lowercase text values: 'admin', 'member', 'observer'
        # No need to map - use the role directly as it comes from frontend
        db_role = role.lower()  # Ensure lowercase: 'admin', 'member', 'observer'
        
        # Validate role
        valid_roles = ["admin", "member", "observer"]
        if db_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}. Must be one of: {', '.join(valid_roles)}")
        
        # Check if membership already exists
        existing_membership = await db.execute_one("""
            SELECT id, role FROM memberships WHERE user_id = $1 AND chapter_id = $2
        """, user_id, chapter_id)
        
        # Create or update membership (allow re-inviting to update password and resend email)
        try:
            if existing_membership:
                # Update role if needed, but allow re-invitation
                membership_id = await db.execute_one("""
                    UPDATE memberships
                    SET role = $3
                    WHERE user_id = $1 AND chapter_id = $2
                    RETURNING id
                """, user_id, chapter_id, db_role)
                logger.info(f"Updated existing membership for user {email} in chapter {chapter_id}")
            else:
                # Create new membership
                membership_id = await db.execute_one("""
                    INSERT INTO memberships (user_id, chapter_id, role)
                    VALUES ($1, $2, $3)
                    RETURNING id
                """, user_id, chapter_id, db_role)
                logger.info(f"Created new membership for user {email} in chapter {chapter_id}")
        except Exception as e:
            logger.error(f"Error creating membership: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create membership: {str(e)}")
        
        # Get chapter name for email
        chapter = await db.execute_one("""
            SELECT name FROM chapters WHERE id = $1
        """, chapter_id)
        chapter_name = chapter["name"] if chapter else "your chapter"
        
        # Send invitation email
        email_sent = await self._send_invitation_email(email, password, chapter_name, role, user_created)
        
        # Final verification: try to get the user from Supabase to confirm they exist
        try:
            async with httpx.AsyncClient(timeout=30.0) as verify_client:
                verify_user = await verify_client.get(
                    f"{supabase_url}/auth/v1/admin/users/{user_id}",
                    headers={
                        "Authorization": f"Bearer {supabase_service_key}",
                        "apikey": supabase_service_key
                    }
                )
                if verify_user.status_code == 200:
                    verify_data = verify_user.json()
                    logger.info(f"✅ Final verification: User {email} exists in Supabase Auth with ID {user_id}")
                    logger.info(f"   User email confirmed: {verify_data.get('email_confirmed_at') is not None}")
                else:
                    logger.warning(f"⚠️ Could not verify user after creation: {verify_user.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ Verification check failed (non-critical): {e}")
        
        return {
            "email": email,
            "user_id": user_id,
            "role": role,
            "password": password,  # Only returned for logging/debugging
            "email_sent": email_sent,
            "user_created": user_created
        }
    
    async def _send_invitation_email(self, email: str, password: str, chapter_name: str, role: str, is_new_user: bool) -> bool:
        """Send invitation email with password via MailerLite"""
        api_key = os.getenv("MAILERLITE_API_KEY")
        if not api_key:
            logger.warning("MAILERLITE_API_KEY not set, skipping invitation email")
            return False
        
        try:
            # Build HTML email template matching QR code email style
            html_content = f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Welcome to RushRank</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>

  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

    <!-- OUTER WRAPPER -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <!-- MAIN CARD -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background-color:#ffffff;border-radius:14px;overflow:hidden;">

            <!-- HEADER -->
            <tr>
              <td align="center" style="background-color:#013068;padding:24px 18px;">
                <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">
                  Welcome to RushRank
                </h1>
                <p style="margin:4px 0 0 0;font-size:14px;color:#ffffff;opacity:0.85;">
                  {chapter_name}
                </p>
              </td>
            </tr>

            <!-- WELCOME COPY -->
            <tr>
              <td style="padding:20px 22px 12px 22px;color:#111827;font-size:15px;line-height:1.5;">
                <p style="margin:0 0 8px 0;">
                  You've been invited to join <strong>{chapter_name}</strong> on RushRank as a <strong>{role}</strong>.
                </p>
                <p style="margin:0 0 12px 0;color:#4b5563;">
                  Your account has been created. Use the credentials below to log in.
                </p>
              </td>
            </tr>

            <!-- CREDENTIALS BOX -->
            <tr>
              <td style="padding:10px 22px 4px 22px;">
                <div style="padding:18px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-bottom:12px;color:#111827;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">
                        Your Login Credentials
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:8px;color:#111827;font-size:14px;line-height:1.5;">
                        <span style="color:#4b5563;display:inline-block;width:70px;">Email:</span>
                        <span style="font-weight:500;color:#111827;">{email}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:0;color:#111827;font-size:14px;line-height:1.5;">
                        <span style="color:#4b5563;display:inline-block;width:70px;">Password:</span>
                        <span style="font-family:monospace;font-weight:600;color:#013068;font-size:15px;letter-spacing:1px;">{password}</span>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <!-- LOGIN BUTTON -->
            <tr>
              <td align="center" style="padding:20px 22px 12px 22px;">
                <a href="https://rushrank.app/login" style="display:inline-block;padding:12px 28px;background-color:#013068;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                  Log In to RushRank
                </a>
              </td>
            </tr>

            <!-- IMPORTANT NOTE -->
            <tr>
              <td style="padding:6px 22px 18px 22px;color:#111827;font-size:14px;line-height:1.5;">
                <div style="padding:12px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;">
                  <p style="margin:0;color:#92400e;font-weight:500;">
                    ⚠️ Important: Please change your password after logging in for the first time.
                  </p>
                </div>
              </td>
            </tr>

            <!-- INSTRUCTIONS -->
            <tr>
              <td style="padding:6px 22px 18px 22px;color:#111827;font-size:14px;line-height:1.5;">
                <p style="margin:0 0 8px 0;">
                  • Use the button above or visit <a href="https://rushrank.app/login" style="color:#013068;text-decoration:underline;">rushrank.app/login</a><br />
                  • Enter your email and the password shown above<br />
                  • Update your password in account settings after logging in
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:18px 22px 24px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
                <p style="margin:0 0 4px 0;">
                  Questions? Contact your chapter administrator or email <strong>hackman@calpoly.edu</strong>.
                </p>
                <p style="margin:8px 0 0 0;color:#9ca3af;">
                  You're receiving this because you were invited to join {chapter_name} on RushRank.
                </p>
              </td>
            </tr>

          </table>
          <!-- END MAIN CARD -->

        </td>
      </tr>
    </table>

  </body>
</html>
            """
            
            base_url = "https://connect.mailerlite.com/api"
            
            # Use MailerLite Transactional API (if available) or send via campaign
            # For now, we'll create a subscriber with custom fields and use automation
            # Group ID for invited members (triggers automation)
            invitation_group_id = os.getenv("MAILERLITE_INVITATION_GROUP_ID", "172172793341806200")
            
            subscriber_data = {
                "email": email,
                "fields": {
                    "password": password,
                    "chapter_name": chapter_name,
                    "role": role,
                    "login_url": "https://rushrank.app/login"
                },
                "status": "active"
            }
            
            # Log credentials for manual verification/debugging
            logger.info(f"📧 Sending invitation to {email}")
            logger.info(f"🔑 Credentials -> Email: {email} | Password: {password}")
            logger.info(f"👉 Login URL: https://rushrank.app/login")
            
            # Add group ID if provided (triggers automation)
            try:
                numeric_group_id = int(invitation_group_id)
                subscriber_data["groups"] = [numeric_group_id]
                logger.info(f"Adding invitation subscriber to group ID: {numeric_group_id}")
            except ValueError:
                logger.warning(f"MAILERLITE_INVITATION_GROUP_ID '{invitation_group_id}' is not a valid numeric ID. Skipping group assignment.")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Create or update subscriber with invitation data
                subscriber_response = await client.post(
                    f"{base_url}/subscribers",
                    json=subscriber_data,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": f"Bearer {api_key}"
                    }
                )
                
                if subscriber_response.status_code not in (200, 201, 202):
                    # Try PUT for update
                    subscriber_response = await client.put(
                        f"{base_url}/subscribers",
                        json=subscriber_data,
                        headers={
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "Authorization": f"Bearer {api_key}"
                        }
                    )
                
                if subscriber_response.status_code in (200, 201, 202):
                    logger.info(f"✅ Subscriber created/updated for invitation: {email}")
                    if "groups" in subscriber_data:
                        logger.info(f"   Added to group: {invitation_group_id} (automation should trigger)")
                    
                    # The automation will send the email when subscriber is added to the group
                    return True
                else:
                    error_text = subscriber_response.text
                    logger.error(f"❌ Failed to create subscriber for invitation: {subscriber_response.status_code} - {error_text}")
                    # Still return True - user is created, email sending can be retried
                    return False
            
        except Exception as e:
            logger.error(f"Error sending invitation email: {e}", exc_info=True)
            # Don't fail the whole invitation if email fails
            return False

class QuestionnaireService:
    """Questionnaires and PNM answers"""
    
    async def list_questionnaires(self, chapter_id: str) -> List[Questionnaire]:
        db = get_db()
        rows = await db.execute_query("""
            SELECT id, chapter_id, name, schema, active, created_at
            FROM questionnaires
            WHERE chapter_id = $1 AND active = true
            ORDER BY created_at DESC
        """, chapter_id)
        return [
            Questionnaire(
                id=str(r["id"]),
                chapter_id=str(r["chapter_id"]),
                name=r["name"],
                schema=r["schema"] or {},
                active=bool(r["active"]),
                created_at=r["created_at"],
            ) for r in rows
        ]
    
    async def create_questionnaire(self, chapter_id: str, q: QuestionnaireCreate) -> Questionnaire:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO questionnaires (chapter_id, name, schema, active)
            VALUES ($1, $2, $3, $4)
            RETURNING id, chapter_id, name, schema, active, created_at
        """, chapter_id, q.name, q.schema, q.active)
        return Questionnaire(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            schema=row["schema"] or {},
            active=bool(row["active"]),
            created_at=row["created_at"],
        )
    
    async def update_questionnaire(self, questionnaire_id: str, q: QuestionnaireCreate) -> Questionnaire:
        """Update questionnaire schema"""
        db = get_db()
        row = await db.execute_one("""
            UPDATE questionnaires
            SET name = $2, schema = $3, active = $4
            WHERE id = $1
            RETURNING id, chapter_id, name, schema, active, created_at
        """, questionnaire_id, q.name, q.schema, q.active)
        
        if not row:
            return None
        
        return Questionnaire(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            schema=row["schema"] or {},
            active=bool(row["active"]),
            created_at=row["created_at"],
        )
    
    async def save_pnm_answers(self, pnm_id: str, payload: PNMAnswersCreate) -> PNMAnswers:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO pnm_answers (pnm_id, questionnaire_id, answers)
            VALUES ($1, $2, $3)
            RETURNING id, pnm_id, questionnaire_id, answers, created_at
        """, pnm_id, payload.questionnaire_id, payload.answers)
        return PNMAnswers(
            id=str(row["id"]),
            pnm_id=str(row["pnm_id"]),
            questionnaire_id=str(row["questionnaire_id"]) if row["questionnaire_id"] else None,
            answers=row["answers"] or {},
            created_at=row["created_at"],
        )