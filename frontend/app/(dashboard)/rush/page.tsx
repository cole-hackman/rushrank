// Rush page - "Event Night Mode"
// Features:
// 1) Active Event selector at top with localStorage persistence
// 2) Two main actions: Add PNM and Check In
// 3) Mobile-first kiosk-style layout

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2, Calendar, Plus, AlertCircle } from "lucide-react";
import { AddPnmView } from "@/components/rush/AddPnmView";
import { CheckInView } from "@/components/rush/CheckInView";
import { ActionCard } from "@/components/rush/ActionCard";
import { api } from "@/lib/api";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { Button } from "@/ui/components/Button";

type View = "home" | "add-pnm" | "check-in";

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
};

type Attendance = {
  pnm_id: string;
};

export default function RushPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<View>("home");
  const { activeEventId, activeEvent, setActiveEventId, loading: eventLoading } = useActiveEvent();

  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [attendeeCount, setAttendeeCount] = useState(0);

  // Load chapter and events
  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);
        if (cid) {
          const eventsData = await api<Event[]>(`/events?chapter_id=${cid}`);
          setEvents(eventsData);
        }
      } catch (e: any) {
        console.error("Failed to load data:", e);
      }
    })();
  }, []);

  // Load attendance when active event changes
  useEffect(() => {
    if (!activeEventId) {
      setCheckedInIds(new Set());
      setAttendeeCount(0);
      return;
    }
    loadAttendance();
    const interval = setInterval(loadAttendance, 5000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  const loadAttendance = async () => {
    if (!activeEventId) return;
    try {
      const attendance = await api<Attendance[]>(`/events/${activeEventId}/attendance`);
      setCheckedInIds(new Set(attendance.map((a) => a.pnm_id)));
      setAttendeeCount(attendance.length);
    } catch (e) {
      console.error("Failed to load attendance:", e);
    }
  };


  if (currentView === "add-pnm") {
    return <AddPnmView onBack={() => setCurrentView("home")} />;
  }

  if (currentView === "check-in") {
    return <CheckInView onBack={() => setCurrentView("home")} />;
  }

  const hasNoEvents = events.length === 0;

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-4 bg-default-background py-4 px-4 sm:px-6">
      {/* Header */}
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          RUSH
        </span>
        <span className="text-body font-body text-subtext-color">
          Use during rush events for quick PNM intake and check-in
        </span>
      </div>

      {/* Active Event Selector */}
      <div className="w-full rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-subtext-color" />
          <span className="text-caption-bold font-caption-bold text-subtext-color">
            ACTIVE EVENT
          </span>
        </div>

        {hasNoEvents ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="h-8 w-8 text-warning-500" />
            <p className="text-body text-subtext-color text-center">
              No events yet. Create an event to start checking in PNMs.
            </p>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => router.push("/events?action=add")}
            >
              Create Event
            </Button>
          </div>
        ) : (
          <>
            <select
              value={activeEventId || ""}
              onChange={(e) => setActiveEventId(e.target.value || null)}
              className="w-full h-12 px-4 rounded-lg border border-neutral-border dark:border-neutral-600 bg-white dark:bg-neutral-900 text-default-font focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-base"
            >
              <option value="">Select an event...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {new Date(event.date).toLocaleDateString()}
                </option>
              ))}
            </select>
            {activeEvent && (
              <div className="mt-2 flex items-center gap-2 text-sm text-subtext-color">
                <CheckCircle2 className="h-4 w-4 text-success-500" />
                <span>{attendeeCount} checked in</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col gap-3 w-full md:grid md:grid-cols-2 md:gap-4">
        <ActionCard
          title="Add PNM"
          subtitle="Hand phone to PNM for quick intake"
          icon={<UserPlus className="h-6 w-6" />}
          variant="primary"
          onClick={() => setCurrentView("add-pnm")}
          disabled={!activeEventId}
          testId="add-pnm-card"
        />

        <ActionCard
          title="Check In"
          subtitle="Scan QR or search by name"
          icon={<CheckCircle2 className="h-6 w-6" />}
          variant="secondary"
          onClick={() => setCurrentView("check-in")}
          disabled={!activeEventId}
          testId="check-in-card"
        />
      </div>

      {/* Disabled state hint */}
      {!activeEventId && !hasNoEvents && (
        <div className="w-full text-center py-4">
          <p className="text-sm text-subtext-color">
            ↑ Select an event above to enable actions
          </p>
        </div>
      )}
    </div>
  );
}
