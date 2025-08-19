-- RushRank Enhanced Schema with Multi-tenancy and RLS
-- This replaces the existing Drizzle schema with Supabase-compatible tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (if any) in correct order
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS events CASCADE; 
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS voting_rounds CASCADE;
DROP TABLE IF EXISTS pnms CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (mirrors Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Chapters table (organizations/fraternities)
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain_allowlist TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Memberships table (user-chapter relationships with roles)
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'observer')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, chapter_id)
);

-- PNMs table (potential new members)
CREATE TABLE pnms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    major TEXT NOT NULL,
    hometown TEXT,
    year TEXT,
    photo_url TEXT,
    tags TEXT[] DEFAULT '{}',
    walkout_song TEXT,
    weirdest_talent TEXT,
    chick_fil_a_order TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Voting rounds table
CREATE TABLE voting_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('rush', 'dinner', 'interview', 'final')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed')) DEFAULT 'pending',
    room_code TEXT NOT NULL UNIQUE,
    selected_pnm_ids TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Votes table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
    pnm_id UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(round_id, pnm_id, voter_id)
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mandatory', 'optional', 'invite_only')) DEFAULT 'optional',
    location TEXT,
    check_in_code TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Attendance table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    pnm_id UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    checked_in_by UUID REFERENCES users(id),
    notes TEXT,
    UNIQUE(event_id, pnm_id)
);

-- Notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pnm_id UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_chapter_id ON memberships(chapter_id);
CREATE INDEX idx_pnms_chapter_id ON pnms(chapter_id);
CREATE INDEX idx_voting_rounds_chapter_id ON voting_rounds(chapter_id);
CREATE INDEX idx_votes_round_id ON votes(round_id);
CREATE INDEX idx_votes_pnm_id ON votes(pnm_id);
CREATE INDEX idx_votes_voter_id ON votes(voter_id);
CREATE INDEX idx_events_chapter_id ON events(chapter_id);
CREATE INDEX idx_attendance_event_id ON attendance(event_id);
CREATE INDEX idx_attendance_pnm_id ON attendance(pnm_id);
CREATE INDEX idx_notes_pnm_id ON notes(pnm_id);
CREATE INDEX idx_notes_author_id ON notes(author_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pnms ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Users can only see their own record
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Chapters: Members can view their chapter
CREATE POLICY "Members can view their chapter" ON chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = chapters.id
        )
    );

CREATE POLICY "Admins can update their chapter" ON chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = chapters.id
            AND m.role = 'admin'
        )
    );

-- Memberships: Users can see memberships in their chapters
CREATE POLICY "Members can view chapter memberships" ON memberships
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = memberships.chapter_id
        )
    );

CREATE POLICY "Admins can manage memberships" ON memberships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = memberships.chapter_id
            AND m.role = 'admin'
        )
    );

-- PNMs: Members can view PNMs in their chapter
CREATE POLICY "Members can view chapter PNMs" ON pnms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = pnms.chapter_id
        )
    );

CREATE POLICY "Admins can manage PNMs" ON pnms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = pnms.chapter_id
            AND m.role = 'admin'
        )
    );

-- Voting Rounds: Members can view, admins can manage
CREATE POLICY "Members can view chapter rounds" ON voting_rounds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = voting_rounds.chapter_id
        )
    );

CREATE POLICY "Admins can manage rounds" ON voting_rounds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = voting_rounds.chapter_id
            AND m.role = 'admin'
        )
    );

-- Votes: Members can view and create votes in their chapter
CREATE POLICY "Members can view chapter votes" ON votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM voting_rounds vr
            JOIN memberships m ON m.chapter_id = vr.chapter_id
            WHERE vr.id = votes.round_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create votes" ON votes
    FOR INSERT WITH CHECK (
        voter_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM voting_rounds vr
            JOIN memberships m ON m.chapter_id = vr.chapter_id
            WHERE vr.id = votes.round_id
            AND m.user_id = auth.uid()
            AND vr.status = 'active'
        )
    );

CREATE POLICY "Users can update own votes" ON votes
    FOR UPDATE USING (voter_id = auth.uid());

-- Events: Members can view, admins can manage
CREATE POLICY "Members can view chapter events" ON events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = events.chapter_id
        )
    );

CREATE POLICY "Admins can manage events" ON events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.user_id = auth.uid()
            AND m.chapter_id = events.chapter_id
            AND m.role = 'admin'
        )
    );

-- Attendance: Members can view, check-in admins can manage
CREATE POLICY "Members can view chapter attendance" ON attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN memberships m ON m.chapter_id = e.chapter_id
            WHERE e.id = attendance.event_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage attendance" ON attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN memberships m ON m.chapter_id = e.chapter_id
            WHERE e.id = attendance.event_id
            AND m.user_id = auth.uid()
            AND m.role IN ('admin', 'member')
        )
    );

-- Notes: Members can view, authors and admins can manage
CREATE POLICY "Members can view chapter notes" ON notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pnms p
            JOIN memberships m ON m.chapter_id = p.chapter_id
            WHERE p.id = notes.pnm_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create notes" ON notes
    FOR INSERT WITH CHECK (
        author_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM pnms p
            JOIN memberships m ON m.chapter_id = p.chapter_id
            WHERE p.id = notes.pnm_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Authors can update own notes" ON notes
    FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Admins can delete notes" ON notes
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM pnms p
            JOIN memberships m ON m.chapter_id = p.chapter_id
            WHERE p.id = notes.pnm_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );