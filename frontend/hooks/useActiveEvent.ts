"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, getChapterId } from "@/lib/api";

const STORAGE_KEY = "rushapp_active_event_id";
const EVENTS_CACHE_KEY = "rushapp_events_cache";
const EVENTS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the events cache - call this when events are created, updated, or deleted
 */
export function clearEventsCache(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(EVENTS_CACHE_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }
}

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: string;
  chapter_id: string;
};

interface UseActiveEventOptions {
  chapterId?: string | null;
}

export function useActiveEvent(options?: UseActiveEventOptions) {
  const [activeEventId, setActiveEventIdState] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const eventsCacheRef = useRef<{ events: Event[]; timestamp: number; chapterId: string } | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setActiveEventIdState(stored);
      }
      setLoading(false);
    }
  }, []);

  // Load events cache from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(EVENTS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          if (now - parsed.timestamp < EVENTS_CACHE_EXPIRY) {
            eventsCacheRef.current = parsed;
          }
        }
      } catch {
        // Ignore cache errors
      }
    }
  }, []);

  // Fetch event details when ID changes
  useEffect(() => {
    if (!activeEventId) {
      setActiveEvent(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Use provided chapterId or get from cache/API
        let chapterId = options?.chapterId;
        if (!chapterId) {
          chapterId = await getChapterId();
        }
        if (!chapterId || cancelled) return;

        // Check if we have a valid cached events list for this chapter
        let events: Event[] | null = null;
        if (eventsCacheRef.current && 
            eventsCacheRef.current.chapterId === chapterId &&
            Date.now() - eventsCacheRef.current.timestamp < EVENTS_CACHE_EXPIRY) {
          events = eventsCacheRef.current.events;
        }

        // Fetch events if not cached
        if (!events) {
          events = await api<Event[]>(`/events?chapter_id=${chapterId}`);
          if (cancelled) return;
          
          // Cache the events
          eventsCacheRef.current = {
            events,
            timestamp: Date.now(),
            chapterId
          };
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(eventsCacheRef.current));
            } catch {
              // Ignore localStorage errors
            }
          }
        }
        
        const event = events.find((e) => e.id === activeEventId);
        setActiveEvent(event || null);
        
        // Clear stored ID if event no longer exists
        if (!event && typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
          setActiveEventIdState(null);
        }
      } catch (e) {
        console.error("Failed to fetch active event:", e);
        setActiveEvent(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeEventId, options?.chapterId]);

  const setActiveEventId = useCallback((eventId: string | null) => {
    setActiveEventIdState(eventId);
    if (typeof window !== "undefined") {
      if (eventId) {
        localStorage.setItem(STORAGE_KEY, eventId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const clearActiveEvent = useCallback(() => {
    setActiveEventId(null);
    setActiveEvent(null);
  }, [setActiveEventId]);

  return {
    activeEventId,
    activeEvent,
    setActiveEventId,
    clearActiveEvent,
    loading,
  };
}
