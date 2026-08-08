/**
 * React Query hooks for RushRank.
 *
 * Only hooks that are actually used, and actually work, belong here.
 *
 * This file previously exported seventeen hooks, fourteen of which were unused
 * and broken -- they pointed at endpoints that do not exist (`/pnms/:id/comments`,
 * `/chapters/:id`, `/events/:id`) or omitted the `chapter_id` query parameter the
 * API requires (`useCreatePNM`, `useCreateEvent`, `useCreateTag`). Nothing
 * imported them, so nothing failed; they were a trap for the next person who
 * reached for one. Every page talks to `lib/api.ts` directly.
 *
 * If you add a hook here, add it because a component is about to use it, and
 * verify the endpoint exists in python_server/routes.py first.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  getChapterTheme,
  updateChapterTheme,
  getFraternityColors,
  ChapterTheme,
} from "@/lib/api";
import { UserProfile, queryKeys } from "@/types/api";

// =============================================================================
// User
// =============================================================================

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<UserProfile>("/me"),
    retry: false, // don't retry auth failures
  });
}

// =============================================================================
// Chapter theme
// =============================================================================

export function useChapterTheme() {
  return useQuery({
    queryKey: queryKeys.chapterTheme,
    queryFn: getChapterTheme,
    staleTime: 60 * 60 * 1000,
    retry: false, // theme is optional; don't spam logs if the endpoint 401s
  });
}

export function useUpdateChapterTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChapterTheme) => updateChapterTheme(patch),
    onSuccess: (data) => qc.setQueryData(queryKeys.chapterTheme, data),
  });
}

export function useFraternityColors() {
  return useQuery({
    queryKey: queryKeys.fraternityColors,
    queryFn: getFraternityColors,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
