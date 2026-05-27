/**
 * Shared API types for RushRank frontend.
 * 
 * These types match the backend API responses for type-safe data handling.
 */

// =============================================================================
// User & Auth Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Membership {
  id: string;
  user_id: string;
  chapter_id: string;
  role: "admin" | "executive" | "member" | "observer";
  created_at: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  memberships: Membership[];
}

// =============================================================================
// Chapter Types
// =============================================================================

export interface Chapter {
  id: string;
  name: string;
  university?: string;
  created_at?: string;
}

// =============================================================================
// PNM Types
// =============================================================================

export interface PNM {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  bio?: string | null;
  tags?: string[];
  photo_url?: string | null;
  qr_code_url?: string | null;
  chapter_id: string;
  created_at?: string;
  // Computed fields from API
  attendance_count?: number;
  total_events?: number;
  yes_percentage?: number;
  favorite_count?: number;
  is_favorite?: boolean;
  archived?: boolean;
}

export interface PNMCreateInput {
  name: string;
  email?: string;
  phone?: string;
  major?: string;
  hometown?: string;
  year?: string;
  bio?: string;
  tags?: string[];
  chapter_id: string;
}

export interface PNMUpdateInput extends Partial<PNMCreateInput> {
  id: string;
}

// =============================================================================
// Voting Types
// =============================================================================

export type VoteChoice = "YES" | "NO" | "UNKNOWN";

export interface Vote {
  id: string;
  round_id: string;
  pnm_id: string;
  user_id: string;
  choice: VoteChoice;
  favorite: boolean;
  anonymous?: boolean;
  created_at: string;
}

export interface VoteInput {
  round_id: string;
  pnm_id: string;
  choice?: VoteChoice;
  favorite?: boolean;
}

export interface Round {
  id: string;
  chapter_id: string;
  name?: string;
  status: "ACTIVE" | "CLOSED" | "OPEN";
  created_at: string;
}

export interface PNMResult {
  id: string;
  name: string;
  major?: string | null;
  photo_url?: string | null;
  yes_percentage: number;
  vote_count: number;
  yes_count?: number;
  no_count?: number;
  dont_know_count?: number;
  favorite_count: number;
}

// =============================================================================
// Event Types
// =============================================================================

export interface Event {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: string;
  chapter_id: string;
  created_at?: string;
}

export interface EventCreateInput {
  name: string;
  date: string;
  location?: string;
  type: string;
  chapter_id: string;
}

export interface Attendance {
  id: string;
  event_id: string;
  pnm_id: string;
  checked_in_at: string | null;
  checked_in_by?: string | null;
  notes?: string | null;
  // Joined fields
  pnm_name?: string;
  pnm_photo_url?: string | null;
}

// =============================================================================
// Session Types
// =============================================================================

export interface Session {
  id: string;
  round_id: string;
  join_code: string;
  locked?: boolean;
  votes_collected?: number;
  total_voters?: number;
  is_chair?: boolean;
  created_at?: string;
}

export interface SessionCreateInput {
  chapter_id: string;
  timer_seconds?: number;
  anonymous?: boolean;
  swipe_mode?: boolean;
}

// =============================================================================
// Tag Types
// =============================================================================

export interface Tag {
  id: string;
  name: string;
  chapter_id: string;
  color?: string;
  pnm_count?: number;
  created_at?: string;
}

// =============================================================================
// Note/Comment Types
// =============================================================================

export interface Note {
  id: string;
  pnm_id: string;
  author?: string;
  text: string;
  anonymous?: boolean;
  created_at: string;
}

export interface NoteCreateInput {
  text: string;
  anonymous?: boolean;
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Query Keys (for React Query)
// =============================================================================

export const queryKeys = {
  // User
  me: ["me"] as const,
  
  // Chapters
  chapters: ["chapters"] as const,
  chapter: (id: string) => ["chapters", id] as const,
  
  // PNMs
  pnms: (chapterId: string, filters?: { search?: string; tags?: string[] }) => 
    ["pnms", chapterId, filters] as const,
  pnm: (id: string) => ["pnms", "detail", id] as const,
  pnmAttendance: (id: string) => ["pnms", id, "attendance"] as const,
  pnmComments: (id: string) => ["pnms", id, "comments"] as const,
  
  // Rounds
  rounds: (chapterId: string) => ["rounds", chapterId] as const,
  roundResults: (roundId: string) => ["rounds", roundId, "results"] as const,
  openRound: ["rounds", "open"] as const,
  
  // Events
  events: (chapterId: string) => ["events", chapterId] as const,
  event: (id: string) => ["events", id] as const,
  eventAttendance: (eventId: string) => ["events", eventId, "attendance"] as const,
  
  // Sessions
  activeSession: ["sessions", "active"] as const,
  session: (id: string) => ["sessions", id] as const,
  
  // Tags
  tags: (chapterId: string) => ["tags", chapterId] as const,

  // Theme & Colors
  chapterTheme: ["chapter-theme"] as const,
  fraternityColors: ["fraternity-colors"] as const,
} as const;
