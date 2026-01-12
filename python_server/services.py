"""
Business logic services for RushRank
"""
import asyncpg
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
import secrets
import string

from .database import get_db
from .models import *
from io import StringIO, BytesIO
import csv
from PIL import Image, ImageDraw
import os
import httpx
from supabase import create_client

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
        
        query = """
            SELECT c.id, c.name, c.domain_allowlist, c.created_at
            FROM chapters c
            JOIN memberships m ON m.chapter_id = c.id
            WHERE m.user_id = $1
        """
        
        rows = await db.execute_query(query, user_id)
        
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
        
        query = """
            SELECT 1 FROM memberships
            WHERE user_id = $1 AND chapter_id = $2
        """
        
        result = await db.execute_one(query, user_id, chapter_id)
        
        if not result:
            raise HTTPException(status_code=403, detail="Access denied")
    
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

class PNMService:
    """PNM management service"""
    
    async def get_chapter_pnms(self, chapter_id: str) -> List[PNM]:
        """Get all PNMs for a chapter"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, name, major, hometown, year, photo_url, tags,
                   walkout_song, weirdest_talent, chick_fil_a_order, created_at
            FROM pnms
            WHERE chapter_id = $1
            ORDER BY name
        """
        
        rows = await db.execute_query(query, chapter_id)
        
        return [
            PNM(
                id=str(row["id"]),
                chapter_id=str(row["chapter_id"]),
                name=row["name"],
                major=row["major"],
                hometown=row["hometown"],
                year=row["year"],
                photo_url=row["photo_url"],
                tags=row["tags"] or [],
                walkout_song=row["walkout_song"],
                weirdest_talent=row["weirdest_talent"],
                chick_fil_a_order=row["chick_fil_a_order"],
                created_at=row["created_at"]
            )
            for row in rows
        ]
    
    async def get_pnm(self, pnm_id: str) -> Optional[PNM]:
        """Get specific PNM"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, name, major, hometown, year, photo_url, tags,
                   walkout_song, weirdest_talent, chick_fil_a_order, created_at
            FROM pnms
            WHERE id = $1
        """
        
        row = await db.execute_one(query, pnm_id)
        
        if not row:
            return None
        
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=row["tags"] or [],
            walkout_song=row["walkout_song"],
            weirdest_talent=row["weirdest_talent"],
            chick_fil_a_order=row["chick_fil_a_order"],
            created_at=row["created_at"]
        )
    
    async def create_pnm(self, pnm_data: PNMCreate, chapter_id: str) -> PNM:
        """Create new PNM"""
        db = get_db()
        
        query = """
            INSERT INTO pnms (chapter_id, name, major, hometown, year, photo_url, tags,
                              walkout_song, weirdest_talent, chick_fil_a_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, chapter_id, name, major, hometown, year, photo_url, tags,
                      walkout_song, weirdest_talent, chick_fil_a_order, created_at
        """
        
        row = await db.execute_one(
            query,
            chapter_id,
            pnm_data.name,
            pnm_data.major,
            pnm_data.hometown,
            pnm_data.year,
            pnm_data.photo_url,
            pnm_data.tags,
            pnm_data.walkout_song,
            pnm_data.weirdest_talent,
            pnm_data.chick_fil_a_order
        )
        
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=row["tags"] or [],
            walkout_song=row["walkout_song"],
            weirdest_talent=row["weirdest_talent"],
            chick_fil_a_order=row["chick_fil_a_order"],
            created_at=row["created_at"]
        )
    
    async def update_pnm(self, pnm_id: str, pnm_data: PNMCreate) -> PNM:
        """Update PNM"""
        db = get_db()
        
        query = """
            UPDATE pnms
            SET name = $2, major = $3, hometown = $4, year = $5, photo_url = $6,
                tags = $7, walkout_song = $8, weirdest_talent = $9, chick_fil_a_order = $10
            WHERE id = $1
            RETURNING id, chapter_id, name, major, hometown, year, photo_url, tags,
                      walkout_song, weirdest_talent, chick_fil_a_order, created_at
        """
        
        row = await db.execute_one(
            query,
            pnm_id,
            pnm_data.name,
            pnm_data.major,
            pnm_data.hometown,
            pnm_data.year,
            pnm_data.photo_url,
            pnm_data.tags,
            pnm_data.walkout_song,
            pnm_data.weirdest_talent,
            pnm_data.chick_fil_a_order
        )
        
        return PNM(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            name=row["name"],
            major=row["major"],
            hometown=row["hometown"],
            year=row["year"],
            photo_url=row["photo_url"],
            tags=row["tags"] or [],
            walkout_song=row["walkout_song"],
            weirdest_talent=row["weirdest_talent"],
            chick_fil_a_order=row["chick_fil_a_order"],
            created_at=row["created_at"]
        )
    
    async def delete_pnm(self, pnm_id: str) -> bool:
        """Delete PNM"""
        db = get_db()
        
        query = "DELETE FROM pnms WHERE id = $1"
        result = await db.execute_command(query, pnm_id)
        
        return "DELETE 1" in result

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
        
        return [
            VotingRound(
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
            for row in rows
        ]
    
    async def get_active_round(self, chapter_id: str) -> Optional[VotingRoundWithDetails]:
        """Get active voting round for a chapter"""
        db = get_db()
        
        query = """
            SELECT vr.id, vr.chapter_id, vr.type, vr.status, vr.room_code, vr.selected_pnm_ids,
                   vr.started_at, vr.ended_at, vr.created_at,
                   COALESCE(array_length(vr.selected_pnm_ids, 1), 0) as total_pnms,
                   COUNT(DISTINCT v.voter_id) as voter_count
            FROM voting_rounds vr
            LEFT JOIN votes v ON v.round_id = vr.id
            WHERE vr.chapter_id = $1 AND vr.status = 'active'
            GROUP BY vr.id
        """
        
        row = await db.execute_one(query, chapter_id)
        
        if not row:
            return None
        
        return VotingRoundWithDetails(
            id=str(row["id"]),
            chapter_id=str(row["chapter_id"]),
            type=RoundType(row["type"]),
            status=RoundStatus(row["status"]),
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
    
    async def create_round(self, round_data: RoundCreate, chapter_id: str) -> VotingRound:
        """Create new voting round"""
        db = get_db()
        
        # Generate unique room code
        room_code = self._generate_room_code()
        
        # End any existing active rounds
        await db.execute_command(
            "UPDATE voting_rounds SET status = 'completed', ended_at = NOW() WHERE chapter_id = $1 AND status = 'active'",
            chapter_id
        )
        
        query = """
            INSERT INTO voting_rounds (chapter_id, type, room_code, selected_pnm_ids, status, started_at)
            VALUES ($1, $2, $3, $4, 'active', NOW())
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
            SET status = 'completed', ended_at = NOW()
            WHERE id = $1
        """
        
        result = await db.execute_command(query, round_id)
        return "UPDATE 1" in result
    
    async def cast_vote(self, round_id: str, vote_data: VoteCreate, voter_id: str) -> Vote:
        """Cast or update vote in a round"""
        db = get_db()
        
        # Use UPSERT to handle vote updates
        query = """
            INSERT INTO votes (round_id, pnm_id, voter_id, score, is_favorite)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (round_id, pnm_id, voter_id)
            DO UPDATE SET score = $4, is_favorite = $5, created_at = NOW()
            RETURNING id, round_id, pnm_id, voter_id, score, is_favorite, created_at
        """
        
        row = await db.execute_one(
            query,
            round_id,
            vote_data.pnm_id,
            voter_id,
            vote_data.score,
            vote_data.is_favorite
        )
        
        return Vote(
            id=str(row["id"]),
            round_id=str(row["round_id"]),
            pnm_id=str(row["pnm_id"]),
            voter_id=str(row["voter_id"]),
            score=row["score"],
            is_favorite=row["is_favorite"],
            created_at=row["created_at"]
        )
    
    async def get_round_results(self, round_id: str) -> List[PNMWithVotes]:
        """Get voting results for a round"""
        db = get_db()
        
        query = """
            SELECT p.id, p.chapter_id, p.name, p.major, p.hometown, p.year, p.photo_url, p.tags,
                   p.walkout_song, p.weirdest_talent, p.chick_fil_a_order, p.created_at,
                   COUNT(v.id) as vote_count,
                   COUNT(CASE WHEN v.score >= 7 THEN 1 END) as yes_count,
                   COUNT(CASE WHEN v.score <= 4 THEN 1 END) as no_count,
                   COUNT(CASE WHEN v.score BETWEEN 5 AND 6 THEN 1 END) as dont_know_count,
                   COUNT(CASE WHEN v.is_favorite THEN 1 END) as favorite_count,
                   CASE WHEN COUNT(v.id) > 0 THEN
                       ROUND(COUNT(CASE WHEN v.score >= 7 THEN 1 END) * 100.0 / COUNT(v.id), 2)
                   ELSE 0 END as yes_percentage,
                   CASE WHEN COUNT(v.id) > 0 THEN
                       ROUND(STDDEV(v.score::float), 2)
                   ELSE 0 END as controversy_score
            FROM pnms p
            LEFT JOIN votes v ON v.pnm_id = p.id AND v.round_id = $1
            WHERE p.id IN (
                SELECT UNNEST(selected_pnm_ids) FROM voting_rounds WHERE id = $1
            )
            GROUP BY p.id, p.chapter_id, p.name, p.major, p.hometown, p.year, p.photo_url, p.tags,
                     p.walkout_song, p.weirdest_talent, p.chick_fil_a_order, p.created_at
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
                walkout_song=row["walkout_song"],
                weirdest_talent=row["weirdest_talent"],
                chick_fil_a_order=row["chick_fil_a_order"],
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
        """Get events for a chapter"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, name, description, date, type, location,
                   check_in_code, is_active, created_at
            FROM events
            WHERE chapter_id = $1 AND is_active = true
            ORDER BY date
        """
        
        rows = await db.execute_query(query, chapter_id)
        
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
                created_at=row["created_at"]
            )
            for row in rows
        ]
    
    async def get_event(self, event_id: str) -> Optional[Event]:
        """Get specific event"""
        db = get_db()
        
        query = """
            SELECT id, chapter_id, name, description, date, type, location,
                   check_in_code, is_active, created_at
            FROM events
            WHERE id = $1
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
            created_at=row["created_at"]
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
            created_at=row["created_at"]
        )
    
    async def mark_attendance(self, attendance_data: AttendanceCreate, checker_id: str) -> Attendance:
        """Mark PNM attendance at event"""
        db = get_db()
        
        query = """
            INSERT INTO attendance (event_id, pnm_id, checked_in_by, notes)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, pnm_id) DO NOTHING
            RETURNING id, event_id, pnm_id, checked_in_at, checked_in_by, notes
        """
        
        row = await db.execute_one(
            query,
            attendance_data.event_id,
            attendance_data.pnm_id,
            checker_id,
            attendance_data.notes
        )
        
        if not row:
            raise HTTPException(status_code=400, detail="Attendance already marked")
        
        return Attendance(
            id=str(row["id"]),
            event_id=str(row["event_id"]),
            pnm_id=str(row["pnm_id"]),
            checked_in_at=row["checked_in_at"],
            checked_in_by=str(row["checked_in_by"]) if row["checked_in_by"] else None,
            notes=row["notes"]
        )

class ExportService:
    """CSV exports and PNM card generation"""
    
    async def export_pnms_csv(self, chapter_id: str) -> str:
        """Return CSV text for PNMs in a chapter"""
        db = get_db()
        query = """
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
                   COALESCE((
                       SELECT string_agg(t.label, ',')
                       FROM pnm_tags pt
                       JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.pnm_id = p.id
                   ), '') AS tags,
                   COALESCE((
                       SELECT COUNT(*)
                       FROM attendance a
                       WHERE a.pnm_id = p.id
                   ), 0) AS attendance_count,
                   p.created_at
            FROM pnms p
            WHERE p.chapter_id = $1
            ORDER BY p.name
        """
        rows = await db.execute_query(query, chapter_id)
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["id","name","major","hometown","year","photo_url","tags","attendance_count","created_at"])
        for r in rows:
            writer.writerow([
                str(r["id"]), r["name"], r["major"], r["hometown"], r["year"],
                r["photo_url"] or "", r["tags"] or "", r["attendance_count"] or 0, r["created_at"]
            ])
        return output.getvalue()
    
    async def export_round_csv(self, round_id: str) -> str:
        """Return CSV text for a round summary"""
        db = get_db()
        query = """
            SELECT p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.tags,
                   COUNT(v.id) as vote_count,
                   COUNT(CASE WHEN v.score >= 7 THEN 1 END) as yes_count,
                   COUNT(CASE WHEN v.score <= 4 THEN 1 END) as no_count,
                   COUNT(CASE WHEN v.score BETWEEN 5 AND 6 THEN 1 END) as dont_know_count,
                   COUNT(CASE WHEN v.is_favorite THEN 1 END) as favorite_count,
                   CASE WHEN COUNT(v.id) > 0 THEN
                       ROUND(COUNT(CASE WHEN v.score >= 7 THEN 1 END) * 100.0 / COUNT(v.id), 2)
                   ELSE 0 END as yes_percentage
            FROM pnms p
            LEFT JOIN votes v ON v.pnm_id = p.id AND v.round_id = $1
            WHERE p.id IN (SELECT UNNEST(selected_pnm_ids) FROM voting_rounds WHERE id = $1)
            GROUP BY p.id, p.name, p.major, p.hometown, p.year, p.photo_url, p.tags
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
                r["photo_url"] or "", ",".join(r["tags"] or []) if isinstance(r["tags"], list) else (r["tags"] or ""),
                r["vote_count"] or 0, r["yes_count"] or 0, r["no_count"] or 0, r["dont_know_count"] or 0, r["favorite_count"] or 0,
                float(r["yes_percentage"] or 0.0)
            ])
        return output.getvalue()
    
    async def generate_pnm_card(self, pnm_id: str) -> str:
        """Generate a PNM share card image and upload to Supabase Storage. Returns a URL."""
        db = get_db()
        row = await db.execute_one("""
            SELECT p.id, p.name, p.major, p.hometown, p.photo_url, p.created_at
            FROM pnms p WHERE p.id = $1
        """, pnm_id)
        if not row:
            raise HTTPException(status_code=404, detail="PNM not found")
        
        width, height = 900, 1200
        img = Image.new("RGB", (width, height), color=(255,255,255))
        draw = ImageDraw.Draw(img)
        # Header
        draw.rectangle([(0,0),(width,160)], fill=(58,118,255))
        draw.text((40,50), "RushRank", fill=(255,255,255))
        # Photo area
        photo_box = (100, 200, width-100, 700)
        if row["photo_url"]:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(row["photo_url"])
                    resp.raise_for_status()
                    pimg = Image.open(BytesIO(resp.content)).convert("RGB")
                    pimg = pimg.resize((photo_box[2]-photo_box[0], photo_box[3]-photo_box[1]))
                    img.paste(pimg, (photo_box[0], photo_box[1]))
            except Exception:
                draw.rectangle(photo_box, fill=(230,230,230))
                draw.text((photo_box[0]+20, photo_box[1]+20), "Photo unavailable", fill=(120,120,120))
        else:
            draw.rectangle(photo_box, fill=(230,230,230))
            draw.text((photo_box[0]+20, photo_box[1]+20), "No photo", fill=(120,120,120))
        # Text fields
        draw.text((100, 760), f"Name: {row['name']}", fill=(0,0,0))
        draw.text((100, 820), f"Major: {row['major'] or '-'}", fill=(0,0,0))
        draw.text((100, 880), f"Hometown: {row['hometown'] or '-'}", fill=(0,0,0))
        # Footer
        draw.text((100, 1120), "Generated by RushRank", fill=(100,100,100))
        
        # Upload to Supabase Storage if configured
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        bucket = os.getenv("SUPABASE_EXPORTS_BUCKET", "exports")
        filename = f"cards/{pnm_id}.png"
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        
        if supabase_url and supabase_key:
            upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{filename}"
            headers = {"Authorization": f"Bearer {supabase_key}", "Content-Type": "image/png"}
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(upload_url, headers=headers, content=buf.read())
                if r.status_code in (200, 201):
                    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{filename}"
                    return public_url
                else:
                    raise HTTPException(status_code=500, detail=f"Upload failed: {r.status_code}")
        else:
            return f"/exports/{filename}"

class NoteService:
    """Notes/comments on PNMs"""
    
    async def list_notes(self, pnm_id: str) -> List[Note]:
        db = get_db()
        rows = await db.execute_query("""
            SELECT id, pnm_id, author_user_id, body, tags, created_at
            FROM pnm_notes
            WHERE pnm_id = $1
            ORDER BY created_at DESC
        """, pnm_id)
        return [
            Note(
                id=str(r["id"]),
                pnm_id=str(r["pnm_id"]),
                author_id=str(r["author_user_id"]),
                body=r["body"],
                tags=r["tags"] or [],
                created_at=r["created_at"],
            )
            for r in rows
        ]
    
    async def create_note(self, note: NoteCreate, author_id: str) -> Note:
        db = get_db()
        row = await db.execute_one("""
            INSERT INTO pnm_notes (pnm_id, author_user_id, body, tags)
            VALUES ($1, $2, $3, $4)
            RETURNING id, pnm_id, author_user_id, body, tags, created_at
        """, note.pnm_id, author_id, note.body, note.tags)
        return Note(
            id=str(row["id"]),
            pnm_id=str(row["pnm_id"]),
            author_id=str(row["author_user_id"]),
            body=row["body"],
            tags=row["tags"] or [],
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
            SELECT id, label, color, chapter_id
            FROM tags
            WHERE chapter_id = $1
            ORDER BY label
        """, chapter_id)
        return [
            {
                "id": str(r["id"]),
                "label": r["label"],
                "color": r["color"],
                "chapter_id": str(r["chapter_id"]),
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