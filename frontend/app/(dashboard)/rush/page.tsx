// Rush page - "Event Night Mode"
// Features:
// 1) Active Event selector at top with localStorage persistence
// 2) Quick search for PNMs with check-in status
// 3) Two main actions: Add PNM and Check In
// 4) Mobile-first kiosk-style layout

"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2, Search, Calendar, Plus, AlertCircle } from "lucide-react";
import { AddPnmView } from "@/components/rush/AddPnmView";
import { CheckInView } from "@/components/rush/CheckInView";
import { ActionCard } from "@/components/rush/ActionCard";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";

type View = "home" | "add-pnm" | "check-in";

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
};

type PNM = {
  id: string;
  name: string;
  photo_url?: string | null;
  major?: string | null;
  phone?: string | null;
};

type Attendance = {
  pnm_id: string;
};

export default function RushPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<View>("home");
  const { activeEventId, activeEvent, setActiveEventId, loading: eventLoading } = useActiveEvent();

  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pnms, setPnms] = useState<PNM[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
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

  // Load PNMs for search
  useEffect(() => {
    if (!chapterId) return;
    (async () => {
      try {
        const allPnms = await api<PNM[]>(`/pnms?chapter_id=${chapterId}`);
        setPnms(allPnms);
      } catch (e) {
        console.error("Failed to load PNMs:", e);
      }
    })();
  }, [chapterId]);

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

  // Debounced search results
  const filteredPnms = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return pnms.filter((pnm) =>
      pnm.name.toLowerCase().includes(query) ||
      pnm.phone?.includes(query) ||
      pnm.major?.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
  }, [pnms, searchQuery]);

  const handleCheckIn = async (pnmId: string) => {
    if (!activeEventId) {
      toast({ title: "No event selected", description: "Please select an event first" });
      return;
    }
    setCheckingIn(pnmId);
    try {
      await api(`/events/${activeEventId}/attendance`, {
        method: "POST",
        body: { event_id: activeEventId, pnm_id: pnmId },
      });
      toast({ title: "Checked in ✓", description: "PNM successfully checked in" });
      setCheckedInIds(new Set([...checkedInIds, pnmId]));
      setAttendeeCount((prev) => prev + 1);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("already")) {
        toast({ title: "Already checked in", description: "This PNM is already checked in" });
        setCheckedInIds(new Set([...checkedInIds, pnmId]));
      } else {
        toast({ title: "Check-in failed", description: msg });
      }
    } finally {
      setCheckingIn(null);
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

      {/* Quick Search Section */}
      {activeEventId && (
        <div className="w-full rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-subtext-color" />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              QUICK SEARCH
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-subtext-color" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-lg border border-neutral-border dark:border-neutral-600 bg-white dark:bg-neutral-900 text-default-font focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-base"
            />
          </div>

          {/* Search Results */}
          {searchQuery.trim() && (
            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
              {filteredPnms.length === 0 ? (
                <p className="text-sm text-subtext-color py-4 text-center">
                  No PNMs found matching "{searchQuery}"
                </p>
              ) : (
                filteredPnms.map((pnm) => {
                  const isCheckedIn = checkedInIds.has(pnm.id);
                  return (
                    <div
                      key={pnm.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        isCheckedIn
                          ? "border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20"
                          : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      )}
                    >
                      <Avatar image={pnm.photo_url || undefined} size="small">
                        {pnm.name.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-default-font truncate">
                          {pnm.name}
                        </div>
                        {pnm.major && (
                          <div className="text-xs text-subtext-color">{pnm.major}</div>
                        )}
                      </div>
                      {isCheckedIn ? (
                        <Badge variant="success">Checked In</Badge>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => handleCheckIn(pnm.id)}
                          disabled={checkingIn === pnm.id}
                          className="min-h-[36px]"
                        >
                          {checkingIn === pnm.id ? "..." : "Check In"}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

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
