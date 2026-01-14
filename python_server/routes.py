"""
FastAPI routes for RushRank
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse, Response, HTMLResponse
from typing import List, Optional, Dict, Any
import logging
import secrets
import string
import asyncpg
import os

from .auth import get_current_user, get_optional_user
from .models import *
from .database import get_db
from .services import (
    UserService, 
    ChapterService, 
    PNMService, 
    VotingService, 
    EventService,
    ExportService,
    NoteService,
    TagService,
    SessionService,
    UploadService,
    QuestionnaireService,
    InvitationService
)
from .websocket import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize services
user_service = UserService()
chapter_service = ChapterService()
pnm_service = PNMService()
voting_service = VotingService()
event_service = EventService()
export_service = ExportService()
note_service = NoteService()
tag_service = TagService()
session_service = SessionService()
upload_service = UploadService()
questionnaire_service = QuestionnaireService()
invitation_service = InvitationService()

# Auth endpoints
@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user profile with memberships"""
    return await user_service.get_user_profile(current_user["user_id"])

@router.post("/admin/reset-password")
async def admin_reset_password(
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to reset a user's password (admin only)"""
    email = payload.get("email")
    new_password = payload.get("password")
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="email and password required")
    
    # Verify current user is an admin (check if they have any admin membership)
    db = get_db()
    admin_check = await db.execute_one("""
        SELECT 1 FROM memberships WHERE user_id = $1 AND role = 'admin' LIMIT 1
    """, current_user["user_id"])
    
    if not admin_check:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user from Supabase Auth
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get user by email
        get_user_response = await client.get(
            f"{supabase_url}/auth/v1/admin/users",
            params={"email": email},
            headers={
                "Authorization": f"Bearer {supabase_service_key}",
                "apikey": supabase_service_key
            }
        )
        
        if get_user_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to find user")
        
        users_data = get_user_response.json()
        if not users_data.get("users") or len(users_data["users"]) == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = users_data["users"][0]["id"]
        
        # Update password
        update_response = await client.put(
            f"{supabase_url}/auth/v1/admin/users/{user_id}",
            json={
                "password": new_password,
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
            raise HTTPException(status_code=500, detail=f"Failed to reset password: {error_text}")
        
        logger.info(f"Password reset for user {email} by admin {current_user['email']}")
        
        return APIResponse(
            success=True,
            message=f"Password reset successfully for {email}",
            data={"email": email}
        )

@router.post("/admin/promote-to-admin")
async def promote_to_admin(
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Promote a user to admin (admin only)"""
    email = payload.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="email required")
    
    email = email.strip().lower()
    
    # Verify the current user is an admin (self-promotion not allowed for security)
    db = get_db()
    
    # Check if current user is already an admin
    current_user_admin = await db.execute_one("""
        SELECT 1 FROM memberships WHERE user_id = $1 AND role = 'admin' LIMIT 1
    """, current_user["user_id"])
    
    # Only admins can promote users
    if not current_user_admin:
        raise HTTPException(status_code=403, detail="Admin access required to promote users")
    
    # Find user by email
    user = await db.execute_one("""
        SELECT id FROM users WHERE email = $1
    """, email)
    
    if not user:
        raise HTTPException(status_code=404, detail=f"User with email {email} not found")
    
    user_id = str(user["id"])
    
    # Get all chapters the user is a member of
    chapters = await db.execute_query("""
        SELECT DISTINCT chapter_id FROM memberships WHERE user_id = $1
    """, user_id)
    
    if not chapters or len(chapters) == 0:
        raise HTTPException(status_code=404, detail=f"User {email} is not a member of any chapter")
    
    # Update all memberships to admin
    updated_count = 0
    for chapter in chapters:
        chapter_id = str(chapter["chapter_id"])
        await db.execute_command("""
            UPDATE memberships
            SET role = 'admin'
            WHERE user_id = $1 AND chapter_id = $2
        """, user_id, chapter_id)
        updated_count += 1
    
    logger.info(f"Promoted user {email} to admin in {updated_count} chapter(s) by {current_user.get('email')}")
    
    return APIResponse(
        success=True,
        message=f"User {email} promoted to admin in {updated_count} chapter(s)",
        data={"email": email, "chapters_updated": updated_count}
    )

# Membership management endpoints
@router.get("/memberships")
async def list_memberships(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """List all memberships for a chapter with user details (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    db = get_db()
    rows = await db.execute_query("""
        SELECT 
            m.id, m.user_id, m.role, m.created_at,
            u.email, u.created_at as user_created_at
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.chapter_id = $1
        ORDER BY m.created_at DESC
    """, chapter_id)
    
    return [
        {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]),
            "email": row["email"],
            "role": row["role"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "user_created_at": row["user_created_at"].isoformat() if row["user_created_at"] else None,
        }
        for row in rows
    ]

@router.post("/memberships/invite")
async def invite_member(
    payload: Dict[str, Any],
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Invite a member by creating account and sending invitation email (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    # Support both single email and bulk invites
    email = payload.get("email")
    emails = payload.get("emails")  # For bulk invites - array of emails
    role = payload.get("role", "member")
    
    # Validate role
    valid_roles = ["admin", "member", "observer"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Determine if single or bulk invite
    if emails and isinstance(emails, list):
        # Bulk invite
        if len(emails) == 0:
            raise HTTPException(status_code=400, detail="No emails provided")
        
        results = []
        errors = []
        
        for email_addr in emails:
            email_addr = email_addr.strip().lower()
            if not email_addr:
                continue
            
            try:
                result = await invitation_service.invite_user(
                    email_addr, 
                    chapter_id, 
                    role, 
                    current_user["user_id"]
                )
                results.append({
                    "email": email_addr,
                    "success": True,
                    "user_id": result["user_id"]
                })
            except HTTPException as e:
                errors.append({
                    "email": email_addr,
                    "error": e.detail
                })
            except Exception as e:
                logger.error(f"Error inviting {email_addr}: {e}", exc_info=True)
                errors.append({
                    "email": email_addr,
                    "error": str(e)
                })
        
        return APIResponse(
            success=True,
            message=f"Processed {len(results)} invitations, {len(errors)} errors",
            data={
                "successful": results,
                "errors": errors,
                "total": len(results) + len(errors),
                "succeeded": len(results),
                "failed": len(errors)
            }
        )
    elif email:
        # Single invite
        try:
            result = await invitation_service.invite_user(
                email, 
                chapter_id, 
                role, 
                current_user["user_id"]
            )
            return APIResponse(
                success=True,
                message=f"Invitation sent to {email}",
                data={
                    "email": email,
                    "role": role,
                    "user_id": result["user_id"],
                    "email_sent": result["email_sent"]
                }
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error inviting user: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to invite user: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="email or emails required")

@router.put("/memberships/{membership_id}")
async def update_membership_role(
    membership_id: str,
    payload: Dict[str, str],
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Update membership role (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    new_role = payload.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="role required")
    
    # Validate role
    valid_roles = ["admin", "member", "observer"]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    db = get_db()
    
    # Verify membership belongs to chapter
    membership = await db.execute_one("""
        SELECT chapter_id FROM memberships WHERE id = $1
    """, membership_id)
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    if str(membership["chapter_id"]) != chapter_id:
        raise HTTPException(status_code=403, detail="Membership does not belong to this chapter")
    
    # Update role
    await db.execute_command("""
        UPDATE memberships
        SET role = $1
        WHERE id = $2
    """, new_role, membership_id)
    
    # Return updated membership
    updated = await db.execute_one("""
        SELECT m.id, m.user_id, m.role, m.created_at, u.email
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.id = $1
    """, membership_id)
    
    return {
        "id": str(updated["id"]),
        "user_id": str(updated["user_id"]),
        "email": updated["email"],
        "role": updated["role"],
        "created_at": updated["created_at"].isoformat() if updated["created_at"] else None,
    }

# Chapter endpoints
@router.get("/chapters", response_model=List[Chapter])
async def get_user_chapters(
    current_user: dict = Depends(get_current_user)
):
    """Get chapters where user is a member"""
    return await chapter_service.get_user_chapters(current_user["user_id"])

@router.post("/chapters", response_model=Chapter)
async def create_chapter(
    chapter_data: ChapterCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create new chapter (system admin only for now)"""
    return await chapter_service.create_chapter(chapter_data, current_user["user_id"])

# PNM endpoints
@router.get("/pnms")
async def get_pnms(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get PNMs for a chapter with stats"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    
    db = get_db()
    
    # Enhanced query with stats - using junction table for tags
    query = """
        SELECT 
            p.id, p.chapter_id, p.name, p.email, p.phone, p.major, p.hometown, p.year, 
            p.photo_url, p.created_at,
            COALESCE(ARRAY(
                SELECT t.label FROM pnm_tags pt
                JOIN tags t ON t.id = pt.tag_id
                WHERE pt.pnm_id = p.id
            ), ARRAY[]::text[]) AS tags,
            (
                SELECT COUNT(DISTINCT ea.event_id) 
                FROM event_attendance ea 
                JOIN events e ON e.id = ea.event_id 
                WHERE ea.pnm_id = p.id AND e.is_active = true
            ) as attendance_count,
            (
                SELECT COUNT(DISTINCT e.id) 
                FROM events e 
                WHERE e.chapter_id = p.chapter_id AND e.is_active = true
            ) as total_events,
            COALESCE(
                ROUND(
                    (COUNT(CASE WHEN v.value = 'YES' THEN 1 END)::numeric / 
                     NULLIF(COUNT(v.id), 0) * 100)
                ), 0
            ) as yes_percentage,
            COUNT(CASE WHEN v.favorite = true THEN 1 END) > 0 as is_favorite,
            COUNT(CASE WHEN v.favorite = true THEN 1 END) as favorite_count
        FROM pnms p
        LEFT JOIN votes v ON v.pnm_id = p.id
        WHERE p.chapter_id = $1
        GROUP BY p.id, p.chapter_id, p.name, p.email, p.phone, p.major, p.hometown, p.year, 
                 p.photo_url, p.created_at
        ORDER BY p.name
    """
    
    rows = await db.execute_query(query, chapter_id)
    
    return [
        {
            "id": str(row["id"]),
            "chapter_id": str(row["chapter_id"]),
            "name": row["name"],
            "email": row["email"] if "email" in row else None,
            "phone": row["phone"] if "phone" in row else None,
            "major": row["major"],
            "hometown": row["hometown"],
            "year": row["year"],
            "photo_url": row["photo_url"],
            "tags": row["tags"] or [],
            "walkout_song": None,
            "weirdest_talent": None,
            "chick_fil_a_order": None,
            "created_at": row["created_at"],
            "attendance_count": row["attendance_count"],
            "total_events": row["total_events"],
            "yes_percentage": float(row["yes_percentage"]) if row["yes_percentage"] else None,
            "is_favorite": bool(row["is_favorite"]),
            "favorite_count": int(row["favorite_count"]) if row["favorite_count"] else 0
        }
        for row in rows
    ]

@router.post("/pnms", response_model=PNM)
async def create_pnm(
    pnm_data: PNMCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Create new PNM (all members)"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await pnm_service.create_pnm(pnm_data, chapter_id)

@router.get("/pnms/{pnm_id}", response_model=PNM)
async def get_pnm(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific PNM with stats"""
    db = get_db()
    
    # We fetch with stats similar to the list view
    query = """
        SELECT 
            p.*,
            COALESCE(ARRAY(
                SELECT t.label FROM pnm_tags pt
                JOIN tags t ON t.id = pt.tag_id
                WHERE pt.pnm_id = p.id
            ), ARRAY[]::text[]) AS tags,
            (
                SELECT COUNT(DISTINCT ea.event_id) 
                FROM event_attendance ea 
                JOIN events e ON e.id = ea.event_id 
                WHERE ea.pnm_id = p.id AND e.is_active = true
            ) as attendance_count,
            (
                SELECT COUNT(DISTINCT e.id) 
                FROM events e 
                WHERE e.chapter_id = p.chapter_id AND e.is_active = true
            ) as total_events
        FROM pnms p
        WHERE p.id = $1
    """
    
    row = await db.execute_one(query, pnm_id)
    if not row:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_membership(current_user["user_id"], row["chapter_id"])
    
    # Convert row to dict and then to PNM model
    pnm_dict = dict(row)
    pnm_dict["id"] = str(pnm_dict["id"])
    pnm_dict["chapter_id"] = str(pnm_dict["chapter_id"])
    pnm_dict["tags"] = pnm_dict["tags"] or []
    
    return pnm_dict

@router.get("/pnms/{pnm_id}/qr")
async def get_pnm_qr(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get QR code image for PNM"""
    from fastapi.responses import RedirectResponse
    
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    
    # Get QR code URL from database or generate if missing
    db = get_db()
    query = "SELECT qr_code_url FROM pnms WHERE id = $1"
    row = await db.execute_one(query, pnm_id)
    
    qr_code_url = row["qr_code_url"] if row and "qr_code_url" in row else None
    
    # If no QR code exists, generate it
    if not qr_code_url:
        qr_code_url = await pnm_service.generate_qr_code(pnm_id)
        if qr_code_url:
            # Update database
            update_query = "UPDATE pnms SET qr_code_url = $1 WHERE id = $2"
            try:
                await db.execute_command(update_query, qr_code_url, pnm_id)
            except Exception as e:
                # Column might not exist yet
                pass
    
    if not qr_code_url:
        raise HTTPException(status_code=500, detail="Failed to generate QR code")
    
    # Redirect to the QR code image URL
    return RedirectResponse(url=qr_code_url)

@router.put("/pnms/{pnm_id}", response_model=PNM)
async def update_pnm(
    pnm_id: str,
    pnm_data: PNMCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update PNM (all members)"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await pnm_service.update_pnm(pnm_id, pnm_data)

@router.delete("/pnms/{pnm_id}", response_model=APIResponse)
async def delete_pnm(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete PNM (admin only)"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], pnm.chapter_id)
    success = await pnm_service.delete_pnm(pnm_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete PNM")
    
    return APIResponse(success=True, message="PNM deleted successfully")

# PNM photo upload (signed URL)
@router.post("/pnms/upload-url")
async def create_pnm_upload_url(
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """
    Create a signed upload URL for a PNM photo.
    Body: { pnm_id: string, filename: string }
    """
    pnm_id = payload.get("pnm_id")
    filename = payload.get("filename")
    if not pnm_id or not filename:
        raise HTTPException(status_code=400, detail="pnm_id and filename are required")
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await upload_service.create_signed_upload_url(pnm_id, filename)

@router.post("/pnms/{pnm_id}/upload-photo")
async def upload_pnm_photo(
    pnm_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload PNM photo directly via backend"""
    # Verify access
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    
    # Read file content
    content = await file.read()
    
    # Upload
    logger.info(f"Uploading photo for PNM {pnm_id}, size: {len(content)} bytes")
    public_url = await upload_service.upload_pnm_photo(
        pnm_id=pnm_id, 
        file_bytes=content, 
        content_type=file.content_type or "application/octet-stream", 
        filename=file.filename
    )
    
    # Update PNM with new photo URL
    # We must explicitly construct PNMCreate to keep existing data
    # (Using empty values for required fields that aren't changing is risky if the model validates heavily,
    # but currently PNMCreate is a Pydantic model. We should use existing values.)
    update_data = PNMCreate(
        name=pnm.name,
        email=pnm.email,
        phone=pnm.phone,
        major=pnm.major,
        hometown=pnm.hometown,
        year=pnm.year,
        photo_url=public_url,
        tags=pnm.tags,
        fun_fact=pnm.fun_fact
    )
    return await pnm_service.update_pnm(pnm_id, update_data)

# Notes endpoints
@router.get("/pnms/{pnm_id}/notes", response_model=List[Note])
async def list_notes(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await note_service.list_notes(pnm_id)

@router.post("/pnms/{pnm_id}/notes", response_model=Note)
async def create_note(
    pnm_id: str,
    note: NoteCreate,
    current_user: dict = Depends(get_current_user)
):
    if note.pnm_id != pnm_id:
        raise HTTPException(status_code=400, detail="pnm_id mismatch")
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await note_service.create_note(note, current_user["user_id"])

@router.delete("/notes/{note_id}", response_model=APIResponse)
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Admin only - resolve chapter via join
    # For simplicity, fetch pnm_id first
    # If note not found, return 404
    db = get_db()
    row = await db.execute_one("SELECT n.id, p.chapter_id FROM pnm_notes n JOIN pnms p ON p.id = n.pnm_id WHERE n.id = $1", note_id)
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    await chapter_service.verify_admin_access(current_user["user_id"], str(row["chapter_id"]))
    ok = await note_service.delete_note(note_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete note")
    return APIResponse(success=True, message="Note deleted")

# Voting endpoints
@router.get("/rounds", response_model=List[VotingRound])
async def get_rounds(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get voting rounds for a chapter"""
    try:
        await chapter_service.verify_membership(current_user["user_id"], chapter_id)
        return await voting_service.get_chapter_rounds(chapter_id)
    except Exception as e:
        logger.error(f"Error in get_rounds: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch rounds: {str(e)}")

@router.get("/rounds/active", response_model=Optional[VotingRoundWithDetails])
async def get_active_round(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get active voting round for a chapter"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await voting_service.get_active_round(chapter_id)

@router.post("/rounds", response_model=VotingRound)
async def create_round(
    round_data: RoundCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Create new voting round (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    return await voting_service.create_round(round_data, chapter_id)

@router.put("/rounds/{round_id}/end", response_model=APIResponse)
async def end_round(
    round_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End voting round (admin only)"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], round_obj.chapter_id)
    success = await voting_service.end_round(round_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to end round")
    
    return APIResponse(success=True, message="Round ended successfully")

@router.post("/rounds/{round_id}/advance")
async def advance_round(
    round_id: str,
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Set the current PNM in session (admin only)"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    await chapter_service.verify_admin_access(current_user["user_id"], round_obj.chapter_id)
    current_pnm_id = payload.get("current_pnm_id")
    return await session_service.set_current(round_id, current_pnm_id)

@router.post("/rounds/{round_id}/lock")
async def lock_round(
    round_id: str,
    payload: Dict[str, bool],
    current_user: dict = Depends(get_current_user)
):
    """Lock/unlock the current session (admin only)"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    await chapter_service.verify_admin_access(current_user["user_id"], round_obj.chapter_id)
    locked = bool(payload.get("locked", True))
    return await session_service.set_locked(round_id, locked)

@router.post("/votes")
async def create_vote(
    vote_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a vote (YES/NO/UNKNOWN) for a PNM in a round, or update favorite status only"""
    round_id = vote_data.get("round_id")
    pnm_id = vote_data.get("pnm_id")
    choice = vote_data.get("choice")  # YES, NO, or UNKNOWN (optional if only updating favorite)
    favorite = vote_data.get("favorite", False)
    
    if not round_id or not pnm_id:
        raise HTTPException(status_code=400, detail="round_id and pnm_id are required")
    
    db = get_db()
    
    # Verify round exists and user has access
    round_row = await db.execute_one("""
        SELECT chapter_id, status FROM voting_rounds WHERE id = $1
    """, round_id)
    
    if not round_row:
        raise HTTPException(status_code=404, detail="Round not found")
    
    await chapter_service.verify_membership(current_user["user_id"], str(round_row["chapter_id"]))
    
    if round_row["status"] not in ["ACTIVE", "active"]:
        raise HTTPException(status_code=400, detail="Round is not active")
    
    # Map YES/NO/UNKNOWN to score (old schema: score 1-10, new schema: value enum)
    # Old schema mapping: YES=10, NO=1, UNKNOWN=5
    choice_to_score = {"YES": 10, "NO": 1, "UNKNOWN": 5}
    
    # Check if vote already exists (try new schema first, fallback to old)
    existing_vote = None
    use_old_schema = False
    try:
        existing_vote = await db.execute_one("""
            SELECT value, favorite FROM votes
            WHERE round_id = $1 AND pnm_id = $2 AND voter_user_id = $3
        """, round_id, pnm_id, current_user["user_id"])
    except Exception:
        # Fallback to old schema (voter_id + score)
        use_old_schema = True
        try:
            existing_vote = await db.execute_one("""
                SELECT score, is_favorite as favorite FROM votes
                WHERE round_id = $1 AND pnm_id = $2 AND voter_id = $3
            """, round_id, pnm_id, current_user["user_id"])
            # Convert score back to choice
            if existing_vote:
                score = existing_vote["score"]
                if score >= 7:
                    existing_vote["value"] = "YES"
                elif score <= 4:
                    existing_vote["value"] = "NO"
                else:
                    existing_vote["value"] = "UNKNOWN"
        except Exception:
            pass
    
    # If only updating favorite and vote exists, preserve existing choice
    if choice is None and existing_vote:
        choice = existing_vote.get("value")  # Use existing vote value
    elif not choice:
        # No choice and no existing vote - can't create vote without choice
        raise HTTPException(status_code=400, detail="choice is required for new votes")
    
    if choice not in ["YES", "NO", "UNKNOWN"]:
        raise HTTPException(status_code=400, detail="choice must be YES, NO, or UNKNOWN")
    
    # Insert or update vote
    if use_old_schema:
        # Old schema: use voter_id and score
        score = choice_to_score[choice]
        vote_row = await db.execute_one("""
            INSERT INTO votes (round_id, pnm_id, voter_id, score, is_favorite)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (round_id, pnm_id, voter_id)
            DO UPDATE SET score = $4, is_favorite = $5, created_at = NOW()
            RETURNING id, round_id, pnm_id, voter_id, score, is_favorite, created_at
        """, round_id, pnm_id, current_user["user_id"], score, favorite)
        # Convert to expected format
        vote_row = {
            "id": vote_row["id"],
            "round_id": vote_row["round_id"],
            "pnm_id": vote_row["pnm_id"],
            "voter_user_id": vote_row["voter_id"],
            "value": choice,
            "favorite": vote_row["is_favorite"],
            "voted_at": vote_row["created_at"]
        }
    else:
        # New schema: use voter_user_id and value
        vote_row = await db.execute_one("""
            INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (round_id, pnm_id, voter_user_id)
            DO UPDATE SET value = $4, favorite = $5, voted_at = NOW()
            RETURNING id, round_id, pnm_id, voter_user_id, value, favorite, voted_at
        """, round_id, pnm_id, current_user["user_id"], choice, favorite)
    
    # Get updated vote tallies for this PNM in this round
    if use_old_schema:
        tallies_row = await db.execute_one("""
            SELECT 
                COUNT(CASE WHEN score >= 7 THEN 1 END) as yes_count,
                COUNT(CASE WHEN score <= 4 THEN 1 END) as no_count,
                COUNT(CASE WHEN score BETWEEN 5 AND 6 THEN 1 END) as unknown_count,
                COUNT(CASE WHEN is_favorite = true THEN 1 END) as favorites_count
            FROM votes
            WHERE round_id = $1 AND pnm_id = $2
        """, round_id, pnm_id)
    else:
        tallies_row = await db.execute_one("""
            SELECT 
                COUNT(CASE WHEN value = 'YES' THEN 1 END) as yes_count,
                COUNT(CASE WHEN value = 'NO' THEN 1 END) as no_count,
                COUNT(CASE WHEN value = 'UNKNOWN' THEN 1 END) as unknown_count,
                COUNT(CASE WHEN favorite = true THEN 1 END) as favorites_count
            FROM votes
            WHERE round_id = $1 AND pnm_id = $2
        """, round_id, pnm_id)
    
    return {
        "id": str(vote_row["id"]),
        "round_id": str(vote_row["round_id"]),
        "pnm_id": str(vote_row["pnm_id"]),
        "voter_id": str(vote_row.get("voter_user_id") or vote_row.get("voter_id")),
        "choice": vote_row["value"],
        "favorite": vote_row["favorite"],
        "created_at": vote_row["voted_at"].isoformat() if vote_row["voted_at"] else None,
        "tallies": {
            "yes": tallies_row["yes_count"] if tallies_row else 0,
            "no": tallies_row["no_count"] if tallies_row else 0,
            "unknown": tallies_row["unknown_count"] if tallies_row else 0,
            "favorites": tallies_row["favorites_count"] if tallies_row else 0
        }
    }

@router.post("/rounds/{round_id}/votes", response_model=Vote)
async def cast_vote(
    round_id: str,
    vote_data: VoteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Cast vote in a round"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    
    if round_obj.status != RoundStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Round is not active")
    
    await chapter_service.verify_membership(current_user["user_id"], round_obj.chapter_id)
    return await voting_service.cast_vote(round_id, vote_data, current_user["user_id"])

@router.get("/rounds/{round_id}/results", response_model=List[PNMWithVotes])
async def get_round_results(
    round_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get voting results for a round"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    
    await chapter_service.verify_membership(current_user["user_id"], round_obj.chapter_id)
    return await voting_service.get_round_results(round_id)

# Event endpoints
@router.get("/events", response_model=List[Event])
async def get_events(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get events for a chapter"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await event_service.get_chapter_events(chapter_id)

@router.post("/events", response_model=Event)
async def create_event(
    event_data: EventCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Create new event (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    return await event_service.create_event(event_data, chapter_id)

@router.delete("/events/{event_id}", response_model=APIResponse)
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an event (admin only, soft delete)"""
    event = await event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], event.chapter_id)
    success = await event_service.delete_event(event_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete event")
    
    return APIResponse(success=True, message="Event deleted successfully")

@router.get("/events/{event_id}/attendance")
async def get_event_attendance(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance list for an event"""
    event = await event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await chapter_service.verify_membership(current_user["user_id"], event.chapter_id)
    
    db = get_db()
    rows = await db.execute_query("""
        SELECT a.id, a.pnm_id, a.checked_in_at, a.checked_in_by, a.notes,
               p.name as pnm_name, p.photo_url as pnm_photo_url
        FROM attendance a
        JOIN pnms p ON p.id = a.pnm_id
        WHERE a.event_id = $1
        ORDER BY a.checked_in_at DESC
    """, event_id)
    
    return [
        {
            "id": str(row["id"]),
            "pnm_id": str(row["pnm_id"]),
            "checked_in_at": row["checked_in_at"].isoformat() if row["checked_in_at"] else None,
            "checked_in_by": str(row["checked_in_by"]) if row["checked_in_by"] else None,
            "notes": row["notes"],
            "pnm_name": row["pnm_name"],
            "pnm_photo_url": row["pnm_photo_url"],
        }
        for row in rows
    ]

@router.post("/events/{event_id}/attendance", response_model=Attendance)
async def mark_attendance(
    event_id: str,
    attendance_data: AttendanceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Mark PNM attendance at event"""
    event = await event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await chapter_service.verify_membership(current_user["user_id"], event.chapter_id)
    return await event_service.mark_attendance(attendance_data, current_user["user_id"])

@router.post("/events/export")
async def export_attendance(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Export all event attendance as CSV (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    csv_content = await event_service.export_attendance_csv(chapter_id)
    
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=attendance_export_{chapter_id}.csv"
        }
    )

# Tag management
@router.get("/tags")
async def list_tags(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await tag_service.list_tags(chapter_id)

@router.get("/tags/stats")
async def get_tag_statistics(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get tag usage statistics (total tags, most used, tagged PNMs count)"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await tag_service.get_tag_statistics(chapter_id)

@router.post("/tags")
async def create_tag(
    payload: Dict[str, str],
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    label = payload.get("label")
    color = payload.get("color")
    if not label:
        raise HTTPException(status_code=400, detail="label required")
    return await tag_service.create_tag(chapter_id, label, color)

@router.put("/tags/{tag_id}")
async def update_tag(
    tag_id: str,
    payload: Dict[str, str],
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    label = payload.get("label")
    color = payload.get("color")
    if not label:
        raise HTTPException(status_code=400, detail="label required")
    return await tag_service.update_tag(tag_id, label, color)

@router.delete("/tags/{tag_id}", response_model=APIResponse)
async def delete_tag(
    tag_id: str,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    ok = await tag_service.delete_tag(tag_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete tag")
    return APIResponse(success=True, message="Tag deleted")

@router.post("/pnms/{pnm_id}/tags/{tag_id}", response_model=APIResponse)
async def add_tag_to_pnm(
    pnm_id: str,
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_admin_access(current_user["user_id"], pnm.chapter_id)
    await tag_service.add_tag_to_pnm(pnm_id, tag_id)
    return APIResponse(success=True, message="Tag added")

@router.delete("/pnms/{pnm_id}/tags/{tag_id}", response_model=APIResponse)
async def remove_tag_from_pnm(
    pnm_id: str,
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_admin_access(current_user["user_id"], pnm.chapter_id)
    ok = await tag_service.remove_tag_from_pnm(pnm_id, tag_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Tag relation not found")
    return APIResponse(success=True, message="Tag removed")

# Questionnaires
@router.get("/questionnaires", response_model=List[Questionnaire])
async def get_questionnaires(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await questionnaire_service.list_questionnaires(chapter_id)

@router.post("/questionnaires", response_model=Questionnaire)
async def create_questionnaire(
    q: QuestionnaireCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    return await questionnaire_service.create_questionnaire(chapter_id, q)

@router.put("/questionnaires/{questionnaire_id}", response_model=Questionnaire)
async def update_questionnaire(
    questionnaire_id: str,
    q: QuestionnaireCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Update questionnaire schema (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    # Verify questionnaire belongs to chapter
    db = get_db()
    questionnaire = await db.execute_one("""
        SELECT chapter_id FROM questionnaires WHERE id = $1
    """, questionnaire_id)
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    if str(questionnaire["chapter_id"]) != chapter_id:
        raise HTTPException(status_code=403, detail="Questionnaire does not belong to this chapter")
    
    updated = await questionnaire_service.update_questionnaire(questionnaire_id, q)
    if not updated:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    return updated

@router.post("/pnms/{pnm_id}/answers", response_model=PNMAnswers)
async def save_pnm_answers(
    pnm_id: str,
    payload: PNMAnswersCreate,
    current_user: dict = Depends(get_current_user)
):
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await questionnaire_service.save_pnm_answers(pnm_id, payload)

# PNM-specific endpoints
@router.get("/pnms/{pnm_id}/attendance")
async def get_pnm_attendance(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get attendance history for a PNM"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    
    db = get_db()
    rows = await db.execute_query("""
        SELECT a.*, e.name as event_name, e.date as event_date
        FROM attendance a
        JOIN events e ON e.id = a.event_id
        WHERE a.pnm_id = $1
        ORDER BY e.date DESC
    """, pnm_id)
    
    return [dict(row) for row in rows]

@router.get("/pnms/{pnm_id}/questionnaire")
async def get_pnm_questionnaire(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get questionnaire responses for a PNM"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return await questionnaire_service.get_pnm_answers(pnm_id)

@router.get("/rounds/{round_id}/status")
async def get_round_status(
    round_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get real-time round status for voting page"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    await chapter_service.verify_membership(current_user["user_id"], round_obj.chapter_id)
    
    db = get_db()
    
    # Get votes collected count (try new schema first, fallback to old)
    try:
        votes_row = await db.execute_one("""
            SELECT COUNT(DISTINCT voter_user_id) as votes_collected
            FROM votes
            WHERE round_id = $1
        """, round_id)
    except Exception:
        # Fallback to voter_id if voter_user_id doesn't exist (old schema)
        try:
            votes_row = await db.execute_one("""
                SELECT COUNT(DISTINCT voter_id) as votes_collected
                FROM votes
                WHERE round_id = $1
            """, round_id)
        except Exception:
            votes_row = {"votes_collected": 0}
    
    # Get total voters (members of chapter)
    members_row = await db.execute_one("""
        SELECT COUNT(*) as total_voters
        FROM memberships
        WHERE chapter_id = $1
    """, round_obj.chapter_id)
    
    return {
        "round_id": round_id,
        "status": round_obj.status,
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0,
        "timer_remaining": 165  # TODO: implement timer logic
    }

# Open Voting endpoints
@router.post("/rounds/open")
async def ensure_open_round(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Create or return existing open round for async voting"""
    user_id = current_user.get("user_id")
    logger.info(f"ensure_open_round called: user_id={user_id}, chapter_id={chapter_id}")
    
    try:
        # Verify membership
        try:
            await chapter_service.verify_membership(user_id, chapter_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error verifying membership: {e}", exc_info=True)
            raise HTTPException(status_code=403, detail=f"Access denied: {str(e)}")
        
        try:
            db = get_db()
        except RuntimeError as e:
            logger.error(f"Database not initialized: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Check if open round exists
        try:
            existing = await db.execute_one("""
                SELECT id, chapter_id, type, status, room_code, selected_pnm_ids, started_at, ended_at, created_at
                FROM voting_rounds
                WHERE chapter_id = $1 AND type = 'GENERAL' AND (status = 'ACTIVE' OR status = 'active')
                ORDER BY created_at DESC
                LIMIT 1
            """, chapter_id)
        except asyncpg.exceptions.PostgresError as e:
            logger.error(f"Database error checking for existing round: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error checking for existing round: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
        
        if existing:
            logger.info(f"Found existing open round: {existing['id']}")
            # Get PNM IDs from selected_pnm_ids array
            pnm_ids = [str(pnm_id) for pnm_id in (existing.get("selected_pnm_ids") or [])]
            
            return {
                "id": str(existing["id"]),
                "chapter_id": str(existing["chapter_id"]),
                "type": existing["type"],
                "status": existing["status"],
                "selected_pnm_ids": pnm_ids,
                "created_at": existing["created_at"].isoformat() if existing["created_at"] else None
            }
        
        # Create new open round
        logger.info(f"Creating new open round for chapter: {chapter_id}")
        try:
            # Generate room code
            room_code = voting_service._generate_room_code()
            
            # Get all PNM IDs for this chapter
            pnm_ids_row = await db.execute_query("SELECT id FROM pnms WHERE chapter_id = $1", chapter_id)
            pnm_ids_array = [str(r["id"]) for r in pnm_ids_row] if pnm_ids_row else []
            
            round_row = await db.execute_one("""
                INSERT INTO voting_rounds (chapter_id, type, status, room_code, selected_pnm_ids, started_at)
                VALUES ($1, 'GENERAL', 'active', $2, $3, NOW())
                RETURNING id, chapter_id, type, status, room_code, selected_pnm_ids, started_at, ended_at, created_at
            """, chapter_id, room_code, pnm_ids_array)
        except asyncpg.exceptions.PostgresError as e:
            logger.error(f"Database error creating round: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error creating round: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating round: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error creating round: {str(e)}")
        
        if not round_row:
            logger.error("Failed to create round - no row returned")
            raise HTTPException(status_code=500, detail="Failed to create voting round")
        
        round_id = str(round_row["id"])
        logger.info(f"Created round: {round_id} with {len(pnm_ids_array)} PNMs")
        
        return {
            "id": round_id,
            "chapter_id": str(round_row["chapter_id"]),
            "type": round_row["type"],
            "status": round_row["status"],
            "selected_pnm_ids": pnm_ids_array,
            "created_at": round_row["created_at"].isoformat() if round_row["created_at"] else None
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error in ensure_open_round: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/rounds/open/current")
async def get_next_unvoted_pnm(
    current_user: dict = Depends(get_current_user)
):
    """Get next PNM user hasn't voted on in open round"""
    db = get_db()
    
    # Get user's chapter (assume first membership)
    membership = await db.execute_one("""
        SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1
    """, current_user["user_id"])
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not in any chapter")
    
    chapter_id = str(membership["chapter_id"])
    
    # Get open round
    round_row = await db.execute_one("""
        SELECT id, selected_pnm_ids FROM voting_rounds
        WHERE chapter_id = $1 AND type = 'GENERAL' AND (status = 'ACTIVE' OR status = 'active')
        ORDER BY created_at DESC LIMIT 1
    """, chapter_id)
    
    if not round_row:
        return {"round_id": None, "pnm": None, "no_round": True}
    
    round_id = str(round_row["id"])
    selected_pnm_ids = round_row.get("selected_pnm_ids") or []
    
    if not selected_pnm_ids:
        return {"round_id": round_id, "pnm": None, "no_pnms": True}
    
    # Find first PNM user hasn't voted on (using selected_pnm_ids array)
    # Try new schema first, fallback to old
    pnm_row = None
    try:
        pnm_row = await db.execute_one("""
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), ARRAY[]::text[]) as tags
            FROM pnms p
            LEFT JOIN pnm_tags pt ON pt.pnm_id = p.id
            LEFT JOIN tags t ON t.id = pt.tag_id
            WHERE p.id = ANY($1::uuid[])
              AND NOT EXISTS (
                SELECT 1 FROM votes v 
                WHERE v.round_id = $2 
                  AND v.pnm_id = p.id 
                  AND v.voter_user_id = $3
              )
            GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
            ORDER BY p.name
            LIMIT 1
        """, selected_pnm_ids, round_id, current_user["user_id"])
    except Exception:
        # Fallback to voter_id if voter_user_id doesn't exist (old schema)
        try:
            pnm_row = await db.execute_one("""
                SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                       COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), ARRAY[]::text[]) as tags
                FROM pnms p
                LEFT JOIN pnm_tags pt ON pt.pnm_id = p.id
                LEFT JOIN tags t ON t.id = pt.tag_id
                WHERE p.id = ANY($1::uuid[])
                  AND NOT EXISTS (
                    SELECT 1 FROM votes v 
                    WHERE v.round_id = $2 
                      AND v.pnm_id = p.id 
                      AND v.voter_user_id = $3
                  )
                GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
                ORDER BY p.name
                LIMIT 1
            """, selected_pnm_ids, round_id, current_user["user_id"])
        except Exception:
            pass
    
    if not pnm_row:
        # All PNMs have been voted on
        return {"round_id": round_id, "pnm": None, "all_voted": True}
    
    return {
        "round_id": round_id,
        "pnm": {
            "id": str(pnm_row["id"]),
            "name": pnm_row["name"],
            "major": pnm_row["major"] or "",
            "hometown": pnm_row["hometown"],
            "year": pnm_row["year"],
            "bio": None,
            "photo_url": pnm_row["photo_url"],
            "tags": list(pnm_row["tags"]) if pnm_row["tags"] else []
        }
    }

# Live Session endpoints
@router.post("/sessions")
async def create_session(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a live voting session (chair only)"""
    try:
        chapter_id = payload.get("chapter_id")
        if not chapter_id:
            raise HTTPException(status_code=400, detail="chapter_id required")
        
        await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
        
        db = get_db()
        
        # End any existing active sessions
        try:
            await db.execute_command("""
                UPDATE sessions SET ended_at = NOW()
                WHERE round_id IN (SELECT id FROM voting_rounds WHERE chapter_id = $1)
                  AND ended_at IS NULL
            """, chapter_id)
        except Exception as e:
            logger.warning(f"Error ending existing sessions: {e}")
            # Continue anyway
        
        # Create new round for this session
        pnm_ids_row = await db.execute_query("SELECT id FROM pnms WHERE chapter_id = $1", chapter_id)
        pnm_ids = [str(r["id"]) for r in pnm_ids_row] if pnm_ids_row else []
        
        if not pnm_ids:
            raise HTTPException(status_code=400, detail="No PNMs found for this chapter")
        
        room_code = voting_service._generate_room_code()
        join_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        
        # Use 'GENERAL' type (database enum only allows GENERAL, INVITE, BID)
        # Session is identified by the linked session record, not the round type
        round_row = await db.execute_one("""
            INSERT INTO voting_rounds (chapter_id, type, status, room_code, selected_pnm_ids, started_at)
            VALUES ($1, 'GENERAL', 'ACTIVE', $2, $3, NOW())
            RETURNING id
        """, chapter_id, room_code, pnm_ids)
        
        if not round_row:
            raise HTTPException(status_code=500, detail="Failed to create voting round")
        
        round_id = str(round_row["id"])
        
        # Set first PNM as current (first in the pnm_ids array)
        first_pnm_id = pnm_ids[0] if pnm_ids else None
        
        # Create session with first PNM set as current
        session_row = await db.execute_one("""
            INSERT INTO sessions (round_id, join_code, current_pnm_id, locked, started_at)
            VALUES ($1, $2, $3, false, NOW())
            RETURNING id, round_id, join_code, current_pnm_id, locked, started_at
        """, round_id, join_code, first_pnm_id)
        
        if not session_row:
            raise HTTPException(status_code=500, detail="Failed to create session")
        
        # Get votes collected (try new schema first, fallback to old)
        try:
            votes_row = await db.execute_one("""
                SELECT COUNT(DISTINCT voter_user_id) as votes_collected FROM votes WHERE round_id = $1
            """, round_id)
        except Exception:
            # Fallback to voter_id if voter_user_id doesn't exist (old schema)
            try:
                votes_row = await db.execute_one("""
                    SELECT COUNT(DISTINCT voter_id) as votes_collected FROM votes WHERE round_id = $1
                """, round_id)
            except Exception:
                votes_row = {"votes_collected": 0}
        
        members_row = await db.execute_one("""
            SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
        """, chapter_id)
        
        # Check if current user is admin/chair
        admin_check = await db.execute_one("""
            SELECT 1 FROM memberships
            WHERE user_id = $1 AND chapter_id = $2 AND role = 'admin'
        """, current_user["user_id"], chapter_id)
        is_chair = admin_check is not None
        
        return {
            "id": str(session_row["id"]),
            "round_id": round_id,
            "join_code": session_row["join_code"],
            "current_pnm_id": str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None,
            "locked": session_row["locked"],
            "votes_collected": votes_row["votes_collected"] if votes_row else 0,
            "total_voters": members_row["total_voters"] if members_row else 0,
            "is_chair": is_chair
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.post("/sessions/join")
async def join_session(
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Join a live session with join code"""
    join_code = payload.get("join_code")
    if not join_code:
        raise HTTPException(status_code=400, detail="join_code required")
    
    db = get_db()
    
    session_row = await db.execute_one("""
        SELECT s.id, s.round_id, s.join_code, s.current_pnm_id, s.locked,
               vr.chapter_id, vr.selected_pnm_ids
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.join_code = $1 AND s.ended_at IS NULL
    """, join_code)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    chapter_id = str(session_row["chapter_id"])
    round_id = str(session_row["round_id"])
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    
    # Get ordered PNM list from round
    pnm_ids = session_row.get("selected_pnm_ids") or []
    
    # Get current PNM details if exists
    current_pnm_id = str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None
    current_pnm = None
    if current_pnm_id:
        pnm_row = await db.execute_one("""
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), ARRAY[]::text[]) as tags
            FROM pnms p
            LEFT JOIN pnm_tags pt ON pt.pnm_id = p.id
            LEFT JOIN tags t ON t.id = pt.tag_id
            WHERE p.id = $1
            GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
        """, current_pnm_id)
        
        if pnm_row:
            current_pnm = {
                "id": str(pnm_row["id"]),
                "name": pnm_row["name"],
                "major": pnm_row["major"],
                "hometown": pnm_row["hometown"],
                "year": pnm_row["year"],
                "bio": None,
                "photo_url": pnm_row["photo_url"],
                "tags": list(pnm_row["tags"]) if pnm_row["tags"] else []
            }
    
    # Get existing votes for this user in this round (try new schema first, fallback to old)
    existing_votes = []
    try:
        existing_votes = await db.execute_query("""
            SELECT pnm_id, value, favorite
            FROM votes
            WHERE round_id = $1 AND voter_user_id = $2
        """, round_id, current_user["user_id"])
    except Exception:
        # Fallback to old schema (voter_id + score)
        try:
            votes_raw = await db.execute_query("""
                SELECT pnm_id, score, is_favorite
                FROM votes
                WHERE round_id = $1 AND voter_id = $2
            """, round_id, current_user["user_id"])
            # Convert score to choice
            for v in votes_raw:
                score = v["score"]
                if score >= 7:
                    choice = "YES"
                elif score <= 4:
                    choice = "NO"
                else:
                    choice = "UNKNOWN"
                existing_votes.append({
                    "pnm_id": v["pnm_id"],
                    "value": choice,
                    "favorite": v["is_favorite"]
                })
        except Exception:
            pass
    
    user_votes = {
        str(v["pnm_id"]): {
            "choice": v["value"],
            "favorite": v["favorite"]
        }
        for v in existing_votes
    }
    
    # Get stats (try voter_user_id first, fallback to voter_id for old schema)
    try:
        votes_row = await db.execute_one("""
            SELECT COUNT(DISTINCT voter_user_id) as votes_collected FROM votes WHERE round_id = $1
        """, round_id)
    except Exception:
        # Fallback to voter_id if voter_user_id doesn't exist (old schema)
        votes_row = await db.execute_one("""
            SELECT COUNT(DISTINCT voter_id) as votes_collected FROM votes WHERE round_id = $1
        """, round_id)
    
    members_row = await db.execute_one("""
        SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
    """, chapter_id)
    
    # Check if current user is admin/chair
    admin_check = await db.execute_one("""
        SELECT 1 FROM memberships
        WHERE user_id = $1 AND chapter_id = $2 AND role = 'admin'
    """, current_user["user_id"], chapter_id)
    is_chair = admin_check is not None
    
    return {
        "id": str(session_row["id"]),
        "round_id": round_id,
        "join_code": session_row["join_code"],
        "current_pnm_id": current_pnm_id,
        "current_pnm": current_pnm,
        "pnm_ids": [str(pid) for pid in pnm_ids],
        "locked": session_row["locked"],
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0,
        "is_chair": is_chair,
        "user_votes": user_votes
    }

@router.get("/sessions/active")
async def get_active_session(
    current_user: dict = Depends(get_current_user)
):
    """Get user's active session"""
    db = get_db()
    
    # Get user's chapter
    membership = await db.execute_one("""
        SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1
    """, current_user["user_id"])
    
    if not membership:
        return None
    
    chapter_id = str(membership["chapter_id"])
    
    session_row = await db.execute_one("""
        SELECT s.id, s.round_id, s.join_code, s.current_pnm_id, s.locked
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE vr.chapter_id = $1 AND s.ended_at IS NULL
        ORDER BY s.started_at DESC LIMIT 1
    """, chapter_id)
    
    if not session_row:
        return None
    
    # Get stats (try new schema first, fallback to old)
    try:
        votes_row = await db.execute_one("""
            SELECT COUNT(DISTINCT voter_user_id) as votes_collected FROM votes WHERE round_id = $1
        """, str(session_row["round_id"]))
    except Exception:
        # Fallback to voter_id if voter_user_id doesn't exist (old schema)
        try:
            votes_row = await db.execute_one("""
                SELECT COUNT(DISTINCT voter_id) as votes_collected FROM votes WHERE round_id = $1
            """, str(session_row["round_id"]))
        except Exception:
            votes_row = {"votes_collected": 0}
    
    members_row = await db.execute_one("""
        SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
    """, chapter_id)
    
    # Check if current user is admin/chair
    admin_check = await db.execute_one("""
        SELECT 1 FROM memberships
        WHERE user_id = $1 AND chapter_id = $2 AND role = 'admin'
    """, current_user["user_id"], chapter_id)
    is_chair = admin_check is not None
    
    return {
        "id": str(session_row["id"]),
        "round_id": str(session_row["round_id"]),
        "join_code": session_row["join_code"],
        "current_pnm_id": str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None,
        "locked": session_row["locked"],
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0,
        "is_chair": is_chair
    }

@router.post("/sessions/{session_id}/lock")
async def toggle_session_lock(
    session_id: str,
    payload: Dict[str, bool],
    current_user: dict = Depends(get_current_user)
):
    """Lock or unlock a session (chair only)"""
    db = get_db()
    
    # Get session and verify chair access
    session_row = await db.execute_one("""
        SELECT s.round_id, vr.chapter_id
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.id = $1
    """, session_id)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], str(session_row["chapter_id"]))
    
    locked = payload.get("locked", True)
    await db.execute_command("""
        UPDATE sessions SET locked = $1 WHERE id = $2
    """, locked, session_id)
    
    # Broadcast lock change via WebSocket
    await ws_manager.broadcast_lock_change(session_id, locked)
    
    return {"success": True, "locked": locked}

@router.post("/sessions/{session_id}/advance")
async def advance_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Advance to next PNM in session (chair only)"""
    db = get_db()
    
    # Get session
    session_row = await db.execute_one("""
        SELECT s.id, s.round_id, s.current_pnm_id, vr.chapter_id, vr.selected_pnm_ids
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.id = $1 AND s.ended_at IS NULL
    """, session_id)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found or ended")
    
    await chapter_service.verify_admin_access(current_user["user_id"], str(session_row["chapter_id"]))
    
    # Get all PNM IDs in order (convert to strings for comparison)
    pnm_ids = [str(pid) for pid in (session_row["selected_pnm_ids"] or [])]
    if not pnm_ids:
        raise HTTPException(status_code=400, detail="No PNMs in round")
    
    # Get current PNM ID
    current_id = str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None
    
    # Find next PNM
    if current_id and current_id in pnm_ids:
        current_index = pnm_ids.index(current_id)
        next_index = current_index + 1
        if next_index >= len(pnm_ids):
            # Reached end - end the session and mark round as completed
            round_id = str(session_row["round_id"])
            await db.execute_command("""
                UPDATE sessions SET ended_at = NOW() WHERE id = $1
            """, session_id)
            # Also update round status to ENDED
            try:
                await db.execute_command("""
                    UPDATE voting_rounds SET status = 'ENDED', ended_at = NOW() WHERE id = $1
                """, round_id)
            except Exception:
                # If status column doesn't support 'ENDED', try 'completed'
                try:
                    await db.execute_command("""
                        UPDATE voting_rounds SET status = 'completed', ended_at = NOW() WHERE id = $1
                    """, round_id)
                except Exception:
                    pass  # Ignore if status update fails
            
            # Broadcast session ended via WebSocket
            await ws_manager.broadcast_session_end(session_id, round_id)
            
            return {
                "success": True,
                "current_pnm_id": None,
                "session_ended": True,
                "round_id": round_id
            }
    else:
        # No current PNM or not in list - start with first
        next_index = 0
    
    next_pnm_id = pnm_ids[next_index]
    
    await db.execute_command("""
        UPDATE sessions SET current_pnm_id = $1 WHERE id = $2
    """, next_pnm_id, session_id)
    
    # Get PNM details for broadcast
    pnm_row = await db.execute_one("""
        SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
               COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), ARRAY[]::text[]) as tags
        FROM pnms p
        LEFT JOIN pnm_tags pt ON pt.pnm_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
    """, next_pnm_id)
    
    pnm_data = None
    if pnm_row:
        pnm_data = {
            "id": str(pnm_row["id"]),
            "name": pnm_row["name"],
            "major": pnm_row["major"],
            "hometown": pnm_row["hometown"],
            "year": pnm_row["year"],
            "photo_url": pnm_row["photo_url"],
            "tags": list(pnm_row["tags"]) if pnm_row["tags"] else []
        }
    
    # Broadcast PNM advance via WebSocket
    await ws_manager.broadcast_pnm_advance(session_id, next_pnm_id, pnm_data)
    
    return {"success": True, "current_pnm_id": next_pnm_id, "session_ended": False}

@router.get("/sessions/{session_id}/current")
async def get_session_current(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current PNM for a session"""
    db = get_db()
    
    # Get session and verify access
    session_row = await db.execute_one("""
        SELECT s.id, s.round_id, s.current_pnm_id, s.locked, vr.chapter_id
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.id = $1 AND s.ended_at IS NULL
    """, session_id)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    chapter_id = str(session_row["chapter_id"])
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    
    current_pnm_id = str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None
    
    if not current_pnm_id:
        return {"pnm": None, "locked": session_row["locked"]}
    
    # Get PNM details with tags
    pnm_row = await db.execute_one("""
        SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
               COALESCE(array_agg(DISTINCT t.label) FILTER (WHERE t.label IS NOT NULL), ARRAY[]::text[]) as tags
        FROM pnms p
        LEFT JOIN pnm_tags pt ON pt.pnm_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url
    """, current_pnm_id)
    
    if not pnm_row:
        return {"pnm": None, "locked": session_row["locked"]}
    
    return {
        "pnm": {
            "id": str(pnm_row["id"]),
            "name": pnm_row["name"],
            "major": pnm_row["major"],
            "hometown": pnm_row["hometown"],
            "year": pnm_row["year"],
            "bio": None,
            "photo_url": pnm_row["photo_url"],
            "tags": list(pnm_row["tags"]) if pnm_row["tags"] else []
        },
        "locked": session_row["locked"]
    }

# Unified export endpoint
@router.get("/export/csv")
async def export_csv_unified(
    entity: str = Query(..., description="Entity type: pnms or results"),
    chapter_id: Optional[str] = Query(None),
    roundId: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Unified CSV export endpoint"""
    if entity == "pnms":
        if not chapter_id:
            raise HTTPException(status_code=400, detail="chapter_id required for pnms export")
        await chapter_service.verify_membership(current_user["user_id"], chapter_id)
        csv_text = await export_service.export_pnms_csv(chapter_id)
        filename = f"pnms_{chapter_id}.csv"
    elif entity == "results":
        if not roundId:
            raise HTTPException(status_code=400, detail="roundId required for results export")
        round_obj = await voting_service.get_round(roundId)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Round not found")
        await chapter_service.verify_membership(current_user["user_id"], round_obj.chapter_id)
        csv_text = await export_service.export_round_csv(roundId)
        filename = f"results_{roundId}.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# PNM share card endpoint
@router.get("/pnms/{pnm_id}/share-card")
async def get_pnm_share_card(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get shareable PNM card graphic"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    url = await export_service.generate_pnm_card(pnm_id)
    return {"url": url}

# Export endpoints
@router.get("/exports/pnms.csv")
async def export_pnms_csv(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Export PNMs CSV for a chapter"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    csv_text = await export_service.export_pnms_csv(chapter_id)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="pnms_{chapter_id}.csv"'}
    )

@router.get("/exports/rounds/{round_id}.csv")
async def export_round_csv(
    round_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Export round results CSV"""
    round_obj = await voting_service.get_round(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    await chapter_service.verify_membership(current_user["user_id"], round_obj.chapter_id)
    csv_text = await export_service.export_round_csv(round_id)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="round_{round_id}.csv"'}
    )

# Back-compat path for current frontend
@router.get("/rounds/{round_id}/export")
async def export_round_csv_compat(
    round_id: str,
    current_user: dict = Depends(get_current_user)
):
    return await export_round_csv(round_id, current_user)

@router.post("/exports/pnm-card/{pnm_id}")
async def generate_pnm_card(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate a PNM card and return its URL"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    url = await export_service.generate_pnm_card(pnm_id)
    return {"url": url}

@router.post("/exports/pnm-cards/bulk")
async def generate_pnm_cards_bulk(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Generate images for multiple PNMs and return ZIP file URL"""
    chapter_id = payload.get("chapter_id")
    pnm_ids = payload.get("pnm_ids")
    
    if not chapter_id and not pnm_ids:
        raise HTTPException(status_code=400, detail="Either chapter_id or pnm_ids required")
    
    # Verify access
    if chapter_id:
        await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    elif pnm_ids:
        # Verify user has access to all PNMs
        for pnm_id in pnm_ids:
            pnm = await pnm_service.get_pnm(pnm_id)
            if pnm:
                await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    
    url = await export_service.generate_pnm_cards_bulk(chapter_id=chapter_id, pnm_ids=pnm_ids)
    return {"url": url, "message": "Bulk export completed successfully"}

# Health check
@router.get("/health")
async def health_check():
    """API health check"""
    return {"status": "healthy", "version": "2.0.0"}

# QR Code Public Endpoints (No Auth)
@router.get("/qr.png")
async def get_qr_image(email: str = Query(..., description="PNM Email")):
    """Get PNM QR code image by email (public for email clients)"""
    pnm = await pnm_service.get_pnm_by_email(email)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    qr_bytes = pnm_service.get_qr_bytes(pnm.id)
    return Response(content=qr_bytes, media_type="image/png")

@router.get("/qr")
async def get_qr_page(email: str = Query(..., description="PNM Email")):
    """Get PNM QR code page by email (public backup link)"""
    pnm = await pnm_service.get_pnm_by_email(email)
    if not pnm:
        return HTMLResponse(content="<h1>PNM not found</h1>", status_code=404)
        
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Your Access Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{ font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f5f5f5; }}
            .card {{ background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 90%; width: 320px; }}
            h1 {{ margin: 0 0 1rem 0; color: #111827; font-size: 1.5rem; }}
            p {{ color: #4b5563; margin-bottom: 2rem; }}
            img {{ display: block; margin: 0 auto; width: 260px; height: 260px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>{pnm.name}</h1>
            <p>Scan to check in</p>
            <img src="/api/qr.png?email={email}" alt="QR Code" />
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)