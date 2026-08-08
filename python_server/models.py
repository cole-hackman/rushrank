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

# The rush funnel starts before formal rush does. A prospect is someone the
# chapter is talking to -- an Instagram DM in July, a name from the activities
# fair -- and lives in the same table as PNMs so that notes, tags, photos and
# event attendance all work from the first contact. See migration 0015.
class PNMStage(str, Enum):
    PROSPECT = "prospect"
    PNM = "pnm"
    BID = "bid"
    PLEDGED = "pledged"

class PNMSource(str, Enum):
    INSTAGRAM = "instagram"
    REFERRAL = "referral"
    TABLING = "tabling"
    INTEREST_FORM = "interest_form"
    WALK_UP = "walk_up"
    IMPORT = "import"
    MANUAL = "manual"
    OTHER = "other"

class ContactStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    RESPONDED = "responded"
    INVITED = "invited"
    NO_RESPONSE = "no_response"

class PNMCreate(BaseModel):
    name: str
    # Optional so a prospect can be logged from a DM with nothing but a handle.
    # Formal PNM creation still requires it -- enforced in PNMService.create_pnm,
    # not here, because the public interest form legitimately has neither.
    email: Optional[str] = None
    stage: PNMStage = PNMStage.PNM
    source: Optional[PNMSource] = None
    instagram_handle: Optional[str] = None
    owner_user_id: Optional[str] = None
    phone: Optional[str] = None
    major: Optional[str] = None
    hometown: Optional[str] = None
    year: Optional[str] = None
    photo_url: Optional[str] = None
    tags: List[str] = []
    walkout_song: Optional[str] = None
    weirdest_talent: Optional[str] = None
    fun_fact: Optional[str] = None
    chick_fil_a_order: Optional[str] = None

class PNM(BaseModel):
    # Every optional field carries an explicit `= None`. In Pydantic v2,
    # `Optional[str]` WITHOUT a default is required-but-nullable, so omitting a
    # field raises ValidationError rather than defaulting to None. That is why
    # GET /pnms/{id} (which selects p.* and has no walkout_song column) and
    # get_round_results (which never selects email/phone/fun_fact) both failed
    # on every row. See docs/AUDIT-2026-08.md.
    id: str
    chapter_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    # Nullable in the DB: CSV import and the public intake form cannot always
    # supply a major, and 0013 relaxes the legacy NOT NULL.
    major: Optional[str] = None
    hometown: Optional[str] = None
    year: Optional[str] = None
    photo_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    walkout_song: Optional[str] = None
    weirdest_talent: Optional[str] = None
    fun_fact: Optional[str] = None
    chick_fil_a_order: Optional[str] = None
    created_at: datetime
    attendance_count: Optional[int] = None
    total_events: Optional[int] = None
    archived: bool = False
    # Pipeline (migration 0015). Defaults match the column defaults so a row
    # selected before those columns existed still validates.
    stage: PNMStage = PNMStage.PNM
    source: Optional[PNMSource] = None
    instagram_handle: Optional[str] = None
    contact_status: ContactStatus = ContactStatus.NEW
    owner_user_id: Optional[str] = None
    owner_name: Optional[str] = None
    last_contacted_at: Optional[datetime] = None

class PipelineUpdate(BaseModel):
    """Move a prospect along. Every field optional -- the board sends one at a time.

    `touch` stamps last_contacted_at, so dragging a card to "contacted" records
    when, without the caller having to send a timestamp it would get wrong
    across time zones.
    """
    stage: Optional[PNMStage] = None
    contact_status: Optional[ContactStatus] = None
    owner_user_id: Optional[str] = None
    source: Optional[PNMSource] = None
    instagram_handle: Optional[str] = None
    touch: bool = False

class PNMWithVotes(PNM):
    # These four were previously declared on BulkArchiveRequest -- a single
    # indentation slip that broke two endpoints at once: bulk-archive rejected
    # every request as missing four required fields, and these vote statistics
    # were silently dropped from /rounds/{id}/results because Pydantic ignores
    # undeclared kwargs. The frontend reads yes_percentage and favorite_count as
    # required, so results rendered 0% for every PNM.
    vote_count: int = 0
    yes_count: int = 0
    no_count: int = 0
    dont_know_count: int = 0
    favorite_count: int = 0
    yes_percentage: float = 0.0
    controversy_score: float = 0.0

class BulkArchiveRequest(BaseModel):
    pnm_ids: List[str]
    archived: bool

# Voting Models
# The legacy lowercase members ('rush', 'dinner', 'interview', 'final',
# 'pending', 'completed') are gone. create_round binds `round_data.type.value`
# straight into the INSERT, so leaving them would let a client write a value
# that violates the CHECK constraint 0013 adds. The only sender of type="rush"
# was /voting/admin, deleted in the previous PR. The normalizing trigger on
# voting_rounds remains as defence in depth for anything still in flight.
class RoundType(str, Enum):
    GENERAL = "GENERAL"
    INVITE = "INVITE"
    BID = "BID"

class VoteValue(str, Enum):
    YES = "YES"
    NO = "NO"
    UNKNOWN = "UNKNOWN"

class RoundStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    ENDED = "ENDED"

class RoundCreate(BaseModel):
    type: RoundType
    selected_pnm_ids: List[str]

class CutoffMode(str, Enum):
    TOP_N = "top_n"
    MIN_YES_PCT = "min_yes_pct"

class CutoffRequest(BaseModel):
    """Advance the top of a finished round into the next one.

    `dry_run` is the important field: the confirmation dialog calls the same
    endpoint with dry_run=True to get the authoritative split before anything
    is written, so the preview the chair approves is the one that executes.
    """
    mode: CutoffMode
    value: float = Field(..., gt=0, description="N for top_n, a percentage for min_yes_pct")
    next_round_type: RoundType = RoundType.GENERAL
    archive_cut: bool = False
    dry_run: bool = True

class VotingRound(BaseModel):
    id: str
    chapter_id: str
    type: RoundType
    status: RoundStatus
    # Nullable for rounds created before room_code existed; 0013 backfills, but
    # a row can still arrive NULL from a database mid-migration.
    room_code: Optional[str] = None
    selected_pnm_ids: List[str] = Field(default_factory=list)
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

class VotingRoundWithDetails(VotingRound):
    total_pnms: int
    voter_count: int

# Votes are YES/NO/UNKNOWN, not a 1-10 score. The legacy `votes.score` and
# `votes.is_favorite` columns survive as deprecated shadows after 0013, but
# canonical writes leave them NULL -- so reading them into non-Optional fields
# raised ValidationError. No frontend call site uses POST /rounds/{id}/votes,
# so reshaping these models breaks nothing.
class VoteCreate(BaseModel):
    pnm_id: str
    value: VoteValue
    favorite: bool = False

class Vote(BaseModel):
    id: str
    round_id: str
    pnm_id: str
    voter_id: str
    value: VoteValue
    favorite: bool = False
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
    attendee_count: Optional[int] = None

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
    anonymous: bool = True

class Note(BaseModel):
    id: str
    pnm_id: str
    author_id: Optional[str] = None
    # Display name for the note's author -- the member's email, or "Anonymous"
    # when the note was left anonymously. The PNM detail page renders this.
    author: Optional[str] = None
    body: str
    anonymous: bool = True
    likes_count: int = 0
    created_at: datetime

# Questionnaire Models
class QuestionnaireCreate(BaseModel):
    name: str
    schema: Dict[str, Any]
    active: bool = True

class Questionnaire(BaseModel):
    id: str
    chapter_id: str
    name: str
    schema: Dict[str, Any]
    active: bool
    created_at: datetime

class PNMAnswersCreate(BaseModel):
    questionnaire_id: Optional[str] = None
    answers: Dict[str, Any]

class PNMAnswers(BaseModel):
    id: str
    pnm_id: str
    questionnaire_id: Optional[str]
    answers: Dict[str, Any]
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