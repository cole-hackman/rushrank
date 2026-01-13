/**
 * React Query hooks for RushRank API.
 * 
 * These hooks wrap the API client with React Query for automatic caching,
 * refetching, and state management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Chapter,
  PNM,
  PNMCreateInput,
  Round,
  PNMResult,
  Event,
  EventCreateInput,
  Attendance,
  Session,
  SessionCreateInput,
  Tag,
  Note,
  NoteCreateInput,
  UserProfile,
  VoteInput,
  queryKeys,
} from "@/types/api";

// =============================================================================
// User Hooks
// =============================================================================

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<UserProfile>("/me"),
    retry: false, // Don't retry auth failures
  });
}

// =============================================================================
// Chapter Hooks
// =============================================================================

export function useChapters() {
  return useQuery({
    queryKey: queryKeys.chapters,
    queryFn: () => api<Chapter[]>("/chapters"),
  });
}

export function useChapter(id: string) {
  return useQuery({
    queryKey: queryKeys.chapter(id),
    queryFn: () => api<Chapter>(`/chapters/${id}`),
    enabled: !!id,
  });
}

// =============================================================================
// PNM Hooks
// =============================================================================

interface PNMFilters {
  search?: string;
  tags?: string[];
}

export function usePNMs(chapterId: string | null, filters?: PNMFilters) {
  return useQuery({
    queryKey: queryKeys.pnms(chapterId || "", filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (chapterId) params.set("chapter_id", chapterId);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.tags?.length) params.set("tags", filters.tags.join(","));
      return api<PNM[]>(`/pnms?${params.toString()}`);
    },
    enabled: !!chapterId,
  });
}

export function usePNM(id: string) {
  return useQuery({
    queryKey: queryKeys.pnm(id),
    queryFn: () => api<PNM>(`/pnms/${id}`),
    enabled: !!id,
  });
}

export function usePNMAttendance(id: string) {
  return useQuery({
    queryKey: queryKeys.pnmAttendance(id),
    queryFn: () => api<Attendance[]>(`/pnms/${id}/attendance`),
    enabled: !!id,
  });
}

export function usePNMComments(id: string) {
  return useQuery({
    queryKey: queryKeys.pnmComments(id),
    queryFn: () => api<Note[]>(`/pnms/${id}/comments`),
    enabled: !!id,
  });
}

export function useCreatePNM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PNMCreateInput) =>
      api<PNM>("/pnms", { method: "POST", body: data }),
    onSuccess: (_, variables) => {
      // Invalidate PNM list for this chapter
      queryClient.invalidateQueries({ 
        queryKey: ["pnms", variables.chapter_id] 
      });
    },
  });
}

export function useDeletePNM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => api(`/pnms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      // Invalidate all PNM queries
      queryClient.invalidateQueries({ queryKey: ["pnms"] });
    },
  });
}

export function useAddComment(pnmId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: NoteCreateInput) =>
      api<Note>(`/pnms/${pnmId}/comments`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.pnmComments(pnmId) 
      });
    },
  });
}

// =============================================================================
// Rounds & Voting Hooks
// =============================================================================

export function useRounds(chapterId: string | null) {
  return useQuery({
    queryKey: queryKeys.rounds(chapterId || ""),
    queryFn: () => api<Round[]>(`/rounds?chapter_id=${chapterId}`),
    enabled: !!chapterId,
  });
}

export function useRoundResults(roundId: string) {
  return useQuery({
    queryKey: queryKeys.roundResults(roundId),
    queryFn: () => api<PNMResult[]>(`/rounds/${roundId}/results`),
    enabled: !!roundId,
  });
}

export function useSubmitVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: VoteInput) =>
      api("/votes", { method: "POST", body: data }),
    onSuccess: (_, variables) => {
      // Invalidate round results
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roundResults(variables.round_id) 
      });
      // Invalidate open round current PNM
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.openRound 
      });
    },
  });
}

// =============================================================================
// Event Hooks
// =============================================================================

export function useEvents(chapterId: string | null) {
  return useQuery({
    queryKey: queryKeys.events(chapterId || ""),
    queryFn: () => api<Event[]>(`/events?chapter_id=${chapterId}`),
    enabled: !!chapterId,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.event(id),
    queryFn: () => api<Event>(`/events/${id}`),
    enabled: !!id,
  });
}

export function useEventAttendance(eventId: string) {
  return useQuery({
    queryKey: queryKeys.eventAttendance(eventId),
    queryFn: () => api<Attendance[]>(`/events/${eventId}/attendance`),
    enabled: !!eventId,
    // Poll every 3 seconds for real-time updates
    refetchInterval: 3000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: EventCreateInput) =>
      api<Event>("/events", { method: "POST", body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.events(variables.chapter_id) 
      });
    },
  });
}

export function useCheckIn(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pnmId: string) =>
      api(`/events/${eventId}/attendance`, {
        method: "POST",
        body: { event_id: eventId, pnm_id: pnmId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventAttendance(eventId) 
      });
    },
  });
}

// =============================================================================
// Session Hooks
// =============================================================================

export function useActiveSession() {
  return useQuery({
    queryKey: queryKeys.activeSession,
    queryFn: () => api<Session | null>("/sessions/active"),
    retry: false,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: SessionCreateInput) =>
      api<Session>("/sessions", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.activeSession 
      });
    },
  });
}

export function useJoinSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (joinCode: string) =>
      api<Session>("/sessions/join", { 
        method: "POST", 
        body: { join_code: joinCode } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.activeSession 
      });
    },
  });
}

// =============================================================================
// Tag Hooks
// =============================================================================

export function useTags(chapterId: string | null) {
  return useQuery({
    queryKey: queryKeys.tags(chapterId || ""),
    queryFn: () => api<Tag[]>(`/tags?chapter_id=${chapterId}`),
    enabled: !!chapterId,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; chapter_id: string; color?: string }) =>
      api<Tag>("/tags", { method: "POST", body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.tags(variables.chapter_id) 
      });
    },
  });
}
