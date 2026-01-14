"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "rushapp_active_event_id";

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: string;
  chapter_id: string;
};

export function useActiveEvent() {
  const [activeEventId, setActiveEventIdState] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Fetch event details when ID changes
  useEffect(() => {
    if (!activeEventId) {
      setActiveEvent(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Get chapters first to get chapter_id
        const chapters = await api<{ id: string }[]>("/chapters");
        const chapterId = chapters[0]?.id;
        if (!chapterId || cancelled) return;

        // Fetch all events and find the active one
        const events = await api<Event[]>(`/events?chapter_id=${chapterId}`);
        if (cancelled) return;
        
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
  }, [activeEventId]);

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
