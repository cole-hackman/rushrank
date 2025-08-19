"""
Pydantic models for RushRank API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# User and Chapter Models
class UserRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member" 
    OBSERVER = "observer"

class ChapterCreate(BaseModel):
    name: str
    domain_allowlist: Optional[List[str]] = []

class Chapter(BaseModel):
    id: str
    name: str
    domain_allowlist: List[str]
    created_at: datetime

class UserCreate(BaseModel):
    email: str

class User(BaseModel):
    id: str
    email: str
    created_at: datetime

class MembershipCreate(BaseModel):
    user_id: str
    chapter_id: str
    role: UserRole

class Membership(BaseModel):
    id: str
    user_id: str
    chapter_id: str
    role: UserRole
    created_at: datetime

# PNM Models
class PNMCreate(BaseModel):
    name: str
    major: str
    hometown: Optional[str] = None
    year: Optional[str] = None
    photo_url: Optional[str] = None
    tags: List[str] = []
    walkout_song: Optional[str] = None
    weirdest_talent: Optional[str] = None
    chick_fil_a_order: Optional[str] = None

class PNM(BaseModel):
    id: str
    chapter_id: str
    name: str
    major: str
    hometown: Optional[str]
    year: Optional[str]
    photo_url: Optional[str]
    tags: List[str]
    walkout_song: Optional[str]
    weirdest_talent: Optional[str]
    chick_fil_a_order: Optional[str]
    created_at: datetime

class PNMWithVotes(PNM):
    vote_count: int
    yes_count: int
    no_count: int
    dont_know_count: int
    favorite_count: int
    yes_percentage: float
    controversy_score: float

# Voting Models
class RoundType(str, Enum):
    RUSH = "rush"
    DINNER = "dinner"
    INTERVIEW = "interview"
    FINAL = "final"

class RoundStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"

class RoundCreate(BaseModel):
    type: RoundType
    selected_pnm_ids: List[str]

class VotingRound(BaseModel):
    id: str
    chapter_id: str
    type: RoundType
    status: RoundStatus
    room_code: str
    selected_pnm_ids: List[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

class VotingRoundWithDetails(VotingRound):
    total_pnms: int
    voter_count: int

class VoteCreate(BaseModel):
    pnm_id: str
    score: int = Field(..., ge=1, le=10)
    is_favorite: bool = False

class Vote(BaseModel):
    id: str
    round_id: str
    pnm_id: str
    voter_id: str
    score: int
    is_favorite: bool
    created_at: datetime

# Event Models
class EventType(str, Enum):
    MANDATORY = "mandatory"
    OPTIONAL = "optional"
    INVITE_ONLY = "invite_only"

class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    date: datetime
    type: EventType = EventType.OPTIONAL
    location: Optional[str] = None
    check_in_code: Optional[str] = None

class Event(BaseModel):
    id: str
    chapter_id: str
    name: str
    description: Optional[str]
    date: datetime
    type: EventType
    location: Optional[str]
    check_in_code: Optional[str]
    is_active: bool
    created_at: datetime

class AttendanceCreate(BaseModel):
    event_id: str
    pnm_id: str
    notes: Optional[str] = None

class Attendance(BaseModel):
    id: str
    event_id: str
    pnm_id: str
    checked_in_at: datetime
    checked_in_by: Optional[str]
    notes: Optional[str]

# Note Models
class NoteCreate(BaseModel):
    pnm_id: str
    body: str
    tags: List[str] = []

class Note(BaseModel):
    id: str
    pnm_id: str
    author_id: str
    body: str
    tags: List[str]
    created_at: datetime

# Response Models
class UserProfile(BaseModel):
    user_id: str
    email: str
    memberships: List[Dict[str, Any]]

class APIResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None