import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface PNM {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photo_url?: string;
  notes_count?: number;
  flagged?: boolean;
  chapter_id: string;
}

export function usePNMs(chapterId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['/api/pnms', { chapter_id: chapterId }],
    enabled: !!user && !!chapterId,
    queryFn: () => {
      const params = new URLSearchParams();
      if (chapterId) params.set('chapter_id', chapterId);
      return fetch(`/api/pnms?${params}`).then(res => res.json());
    },
  });
}

export function useUserChapters() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['/api/chapters'],
    enabled: !!user,
    queryFn: () => fetch('/api/chapters').then(res => res.json()),
  });
}