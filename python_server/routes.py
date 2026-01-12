"""
FastAPI routes for RushRank
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from typing import List, Optional, Dict, Any
import logging
import secrets
import string

from .auth import get_current_user, get_optional_user
from .models import *
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
    QuestionnaireService
)

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

# Auth endpoints
@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user profile with memberships"""
    return await user_service.get_user_profile(current_user["user_id"])

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
    
    from .database import get_db
    db = await get_db()
    
    # Enhanced query with stats
    query = """
        SELECT 
            p.id, p.chapter_id, p.name, p.major, p.hometown, p.year, 
            p.photo_url, p.tags, p.walkout_song, p.weirdest_talent, 
            p.chick_fil_a_order, p.created_at,
            COUNT(DISTINCT a.id) as attendance_count,
            (SELECT COUNT(DISTINCT e.id) FROM events e WHERE e.chapter_id = p.chapter_id) as total_events,
            COALESCE(
                ROUND(
                    (COUNT(CASE WHEN v.score >= 7 THEN 1 END)::numeric / 
                     NULLIF(COUNT(v.id), 0) * 100)
                ), 0
            ) as yes_percentage,
            COUNT(CASE WHEN v.is_favorite = true THEN 1 END) > 0 as is_favorite
        FROM pnms p
        LEFT JOIN attendance a ON a.pnm_id = p.id
        LEFT JOIN votes v ON v.pnm_id = p.id
        WHERE p.chapter_id = $1
        GROUP BY p.id
        ORDER BY p.name
    """
    
    rows = await db.fetch(query, chapter_id)
    
    return [
        {
            "id": str(row["id"]),
            "chapter_id": str(row["chapter_id"]),
            "name": row["name"],
            "major": row["major"],
            "hometown": row["hometown"],
            "year": row["year"],
            "photo_url": row["photo_url"],
            "tags": row["tags"] or [],
            "walkout_song": row["walkout_song"],
            "weirdest_talent": row["weirdest_talent"],
            "chick_fil_a_order": row["chick_fil_a_order"],
            "created_at": row["created_at"],
            "attendance_count": row["attendance_count"],
            "total_events": row["total_events"],
            "yes_percentage": float(row["yes_percentage"]) if row["yes_percentage"] else None,
            "is_favorite": bool(row["is_favorite"])
        }
        for row in rows
    ]

@router.post("/pnms", response_model=PNM)
async def create_pnm(
    pnm_data: PNMCreate,
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Create new PNM (admin only)"""
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    return await pnm_service.create_pnm(pnm_data, chapter_id)

@router.get("/pnms/{pnm_id}", response_model=PNM)
async def get_pnm(
    pnm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific PNM"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_membership(current_user["user_id"], pnm.chapter_id)
    return pnm

@router.put("/pnms/{pnm_id}", response_model=PNM)
async def update_pnm(
    pnm_id: str,
    pnm_data: PNMCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update PNM (admin only)"""
    pnm = await pnm_service.get_pnm(pnm_id)
    if not pnm:
        raise HTTPException(status_code=404, detail="PNM not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], pnm.chapter_id)
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
    await chapter_service.verify_admin_access(current_user["user_id"], pnm.chapter_id)
    return await upload_service.create_signed_upload_url(pnm_id, filename)

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
    from database import get_db
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
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await voting_service.get_chapter_rounds(chapter_id)

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

# Tag management
@router.get("/tags")
async def list_tags(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await tag_service.list_tags(chapter_id)

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
    
    from .database import get_db
    db = await get_db()
    rows = await db.fetch("""
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
    
    from .database import get_db
    db = await get_db()
    
    # Get votes collected count
    votes_row = await db.fetchrow("""
        SELECT COUNT(DISTINCT user_id) as votes_collected
        FROM votes
        WHERE round_id = $1
    """, round_id)
    
    # Get total voters (members of chapter)
    members_row = await db.fetchrow("""
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
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    
    from .database import get_db
    db = await get_db()
    
    # Check if open round exists
    existing = await db.fetchrow("""
        SELECT id, chapter_id, type, status, room_code, selected_pnm_ids, started_at, ended_at, created_at
        FROM voting_rounds
        WHERE chapter_id = $1 AND type = 'GENERAL' AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
    """, chapter_id)
    
    if existing:
        return VotingRound(
            id=str(existing["id"]),
            chapter_id=str(existing["chapter_id"]),
            type=RoundType(existing["type"]),
            status=RoundStatus(existing["status"]),
            room_code=existing["room_code"],
            selected_pnm_ids=existing["selected_pnm_ids"] or [],
            started_at=existing["started_at"],
            ended_at=existing["ended_at"],
            created_at=existing["created_at"])
    
    # Create new open round with all PNMs
    pnm_ids_row = await db.fetch("SELECT id FROM pnms WHERE chapter_id = $1", chapter_id)
    pnm_ids = [str(r["id"]) for r in pnm_ids_row]
    
    room_code = voting_service._generate_room_code()
    row = await db.fetchrow("""
        INSERT INTO voting_rounds (chapter_id, type, status, room_code, selected_pnm_ids, started_at)
        VALUES ($1, 'GENERAL', 'active', $2, $3, NOW())
        RETURNING id, chapter_id, type, status, room_code, selected_pnm_ids, started_at, ended_at, created_at
    """, chapter_id, room_code, pnm_ids)
    
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

@router.get("/rounds/open/current")
async def get_next_unvoted_pnm(
    current_user: dict = Depends(get_current_user)
):
    """Get next PNM user hasn't voted on in open round"""
    from .database import get_db
    db = await get_db()
    
    # Get user's chapter (assume first membership)
    membership = await db.fetchrow("""
        SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1
    """, current_user["user_id"])
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not in any chapter")
    
    chapter_id = str(membership["chapter_id"])
    
    # Get open round
    round_row = await db.fetchrow("""
        SELECT id FROM voting_rounds
        WHERE chapter_id = $1 AND type = 'GENERAL' AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
    """, chapter_id)
    
    if not round_row:
        return None
    
    round_id = str(round_row["id"])
    
    # Find first PNM user hasn't voted on
    pnm_row = await db.fetchrow("""
        SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.tags, p.weirdest_talent
        FROM pnms p
        WHERE p.chapter_id = $1
          AND p.id = ANY(
            SELECT UNNEST(selected_pnm_ids) FROM voting_rounds WHERE id = $2
          )
          AND NOT EXISTS (
            SELECT 1 FROM votes v WHERE v.round_id = $2 AND v.pnm_id = p.id AND v.user_id = $3
          )
        ORDER BY p.name
        LIMIT 1
    """, chapter_id, round_id, current_user["user_id"])
    
    if not pnm_row:
        return None
    
    return {
        "round_id": round_id,
        "pnm": {
            "id": str(pnm_row["id"]),
            "name": pnm_row["name"],
            "major": pnm_row["major"],
            "hometown": pnm_row["hometown"],
            "year": pnm_row["year"],
            "photo_url": pnm_row["photo_url"],
            "tags": pnm_row["tags"] or [],
            "weirdest_talent": pnm_row["weirdest_talent"]
        }
    }

# Live Session endpoints
@router.post("/sessions")
async def create_session(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a live voting session (chair only)"""
    chapter_id = payload.get("chapter_id")
    if not chapter_id:
        raise HTTPException(status_code=400, detail="chapter_id required")
    
    await chapter_service.verify_admin_access(current_user["user_id"], chapter_id)
    
    from .database import get_db
    db = await get_db()
    
    # End any existing active sessions
    await db.execute("""
        UPDATE sessions SET ended_at = NOW()
        WHERE round_id IN (SELECT id FROM voting_rounds WHERE chapter_id = $1)
          AND ended_at IS NULL
    """, chapter_id)
    
    # Create new round for this session
    pnm_ids_row = await db.fetch("SELECT id FROM pnms WHERE chapter_id = $1", chapter_id)
    pnm_ids = [str(r["id"]) for r in pnm_ids_row]
    
    room_code = voting_service._generate_room_code()
    join_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    
    round_row = await db.fetchrow("""
        INSERT INTO voting_rounds (chapter_id, type, status, room_code, selected_pnm_ids, started_at)
        VALUES ($1, 'SESSION', 'active', $2, $3, NOW())
        RETURNING id
    """, chapter_id, room_code, pnm_ids)
    
    round_id = str(round_row["id"])
    
    # Create session
    session_row = await db.fetchrow("""
        INSERT INTO sessions (round_id, join_code, locked, started_at)
        VALUES ($1, $2, false, NOW())
        RETURNING id, round_id, join_code, current_pnm_id, locked, started_at
    """, round_id, join_code)
    
    # Get votes collected
    votes_row = await db.fetchrow("""
        SELECT COUNT(DISTINCT user_id) as votes_collected FROM votes WHERE round_id = $1
    """, round_id)
    
    members_row = await db.fetchrow("""
        SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
    """, chapter_id)
    
    return {
        "id": str(session_row["id"]),
        "round_id": round_id,
        "join_code": session_row["join_code"],
        "current_pnm_id": str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None,
        "locked": session_row["locked"],
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0
    }

@router.post("/sessions/join")
async def join_session(
    payload: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Join a live session with join code"""
    join_code = payload.get("join_code")
    if not join_code:
        raise HTTPException(status_code=400, detail="join_code required")
    
    from .database import get_db
    db = await get_db()
    
    session_row = await db.fetchrow("""
        SELECT s.id, s.round_id, s.join_code, s.current_pnm_id, s.locked,
               vr.chapter_id
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.join_code = $1 AND s.ended_at IS NULL
    """, join_code)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    chapter_id = str(session_row["chapter_id"])
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    
    # Get stats
    votes_row = await db.fetchrow("""
        SELECT COUNT(DISTINCT user_id) as votes_collected FROM votes WHERE round_id = $1
    """, str(session_row["round_id"]))
    
    members_row = await db.fetchrow("""
        SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
    """, chapter_id)
    
    return {
        "id": str(session_row["id"]),
        "round_id": str(session_row["round_id"]),
        "join_code": session_row["join_code"],
        "current_pnm_id": str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None,
        "locked": session_row["locked"],
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0
    }

@router.get("/sessions/active")
async def get_active_session(
    current_user: dict = Depends(get_current_user)
):
    """Get user's active session"""
    from .database import get_db
    db = await get_db()
    
    # Get user's chapter
    membership = await db.fetchrow("""
        SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1
    """, current_user["user_id"])
    
    if not membership:
        return None
    
    chapter_id = str(membership["chapter_id"])
    
    session_row = await db.fetchrow("""
        SELECT s.id, s.round_id, s.join_code, s.current_pnm_id, s.locked
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE vr.chapter_id = $1 AND s.ended_at IS NULL
        ORDER BY s.started_at DESC LIMIT 1
    """, chapter_id)
    
    if not session_row:
        return None
    
    # Get stats
    votes_row = await db.fetchrow("""
        SELECT COUNT(DISTINCT user_id) as votes_collected FROM votes WHERE round_id = $1
    """, str(session_row["round_id"]))
    
    members_row = await db.fetchrow("""
        SELECT COUNT(*) as total_voters FROM memberships WHERE chapter_id = $1
    """, chapter_id)
    
    return {
        "id": str(session_row["id"]),
        "round_id": str(session_row["round_id"]),
        "join_code": session_row["join_code"],
        "current_pnm_id": str(session_row["current_pnm_id"]) if session_row["current_pnm_id"] else None,
        "locked": session_row["locked"],
        "votes_collected": votes_row["votes_collected"] if votes_row else 0,
        "total_voters": members_row["total_voters"] if members_row else 0
    }

@router.post("/sessions/{session_id}/lock")
async def toggle_session_lock(
    session_id: str,
    payload: Dict[str, bool],
    current_user: dict = Depends(get_current_user)
):
    """Lock or unlock a session (chair only)"""
    from .database import get_db
    db = await get_db()
    
    # Get session and verify chair access
    session_row = await db.fetchrow("""
        SELECT s.round_id, vr.chapter_id
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.id = $1
    """, session_id)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], str(session_row["chapter_id"]))
    
    locked = payload.get("locked", True)
    await db.execute("""
        UPDATE sessions SET locked = $1 WHERE id = $2
    """, locked, session_id)
    
    return {"success": True, "locked": locked}

@router.post("/sessions/{session_id}/advance")
async def advance_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Advance to next PNM in session (chair only)"""
    from .database import get_db
    db = await get_db()
    
    # Get session
    session_row = await db.fetchrow("""
        SELECT s.id, s.round_id, vr.chapter_id, vr.selected_pnm_ids
        FROM sessions s
        JOIN voting_rounds vr ON vr.id = s.round_id
        WHERE s.id = $1
    """, session_id)
    
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await chapter_service.verify_admin_access(current_user["user_id"], str(session_row["chapter_id"]))
    
    # Get all PNM IDs in order
    pnm_ids = session_row["selected_pnm_ids"] or []
    if not pnm_ids:
        return {"success": False, "message": "No PNMs in round"}
    
    # Get current PNM index
    current = await db.fetchrow("SELECT current_pnm_id FROM sessions WHERE id = $1", session_id)
    current_id = str(current["current_pnm_id"]) if current and current["current_pnm_id"] else None
    
    # Find next PNM
    if current_id and current_id in pnm_ids:
        current_index = pnm_ids.index(current_id)
        next_index = (current_index + 1) % len(pnm_ids)
    else:
        next_index = 0
    
    next_pnm_id = pnm_ids[next_index]
    
    await db.execute("""
        UPDATE sessions SET current_pnm_id = $1 WHERE id = $2
    """, next_pnm_id, session_id)
    
    return {"success": True, "current_pnm_id": next_pnm_id}

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

# Health check
@router.get("/health")
async def health_check():
    """API health check"""
    return {"status": "healthy", "version": "2.0.0"}