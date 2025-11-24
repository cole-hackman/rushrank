"""
FastAPI routes for RushRank
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from typing import List, Optional
import logging

from auth import get_current_user, get_optional_user
from models import *
from services import (
    UserService, 
    ChapterService, 
    PNMService, 
    VotingService, 
    EventService,
    ExportService
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
@router.get("/pnms", response_model=List[PNM])
async def get_pnms(
    chapter_id: str = Query(..., description="Chapter ID"),
    current_user: dict = Depends(get_current_user)
):
    """Get PNMs for a chapter"""
    await chapter_service.verify_membership(current_user["user_id"], chapter_id)
    return await pnm_service.get_chapter_pnms(chapter_id)

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