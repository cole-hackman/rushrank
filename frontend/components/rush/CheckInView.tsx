"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { QrScanner } from "@/components/events/QrScanner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/ui/tabs";
import { Avatar } from "@/ui/components/Avatar";
import { ArrowLeft, Search, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckInViewProps {
  onBack: () => void;
}

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: string;
};

type PNM = {
  id: string;
  name: string;
  photo_url?: string | null;
  major?: string | null;
  year?: string | null;
  hometown?: string | null;
};

type Attendance = {
  id: string;
  pnm_id: string;
  checked_in_at: string | null;
};

export function CheckInView({ onBack }: CheckInViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pnms, setPnms] = useState<PNM[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);
        if (cid) {
          const eventsData = await api<Event[]>(`/events?chapter_id=${cid}`);
          setEvents(eventsData);
          // Auto-select first event if available
          if (eventsData.length > 0) {
            setSelectedEventId(eventsData[0].id);
          }
        }
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e?.message });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (selectedEventId) {
      loadAttendance();
      loadPnms();
      // Poll attendance every 3 seconds
      const interval = setInterval(loadAttendance, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedEventId]);

  const loadAttendance = async () => {
    if (!selectedEventId) return;
    try {
      const attendance = await api<Attendance[]>(`/events/${selectedEventId}/attendance`);
      setAttendeeCount(attendance.length);
      setCheckedInIds(new Set(attendance.map((a) => a.pnm_id)));
    } catch (e: any) {
      console.error("Failed to load attendance:", e);
    }
  };

  const loadPnms = async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const allPnms = await api<PNM[]>(`/pnms?chapter_id=${chapterId}`);
      setPnms(allPnms);
    } catch (e: any) {
      toast({ title: "Failed to load PNMs", description: e?.message });
      setPnms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const filteredPnms = pnms.filter((pnm) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      pnm.name.toLowerCase().includes(query) ||
      pnm.major?.toLowerCase().includes(query) ||
      pnm.hometown?.toLowerCase().includes(query) ||
      pnm.year?.toLowerCase().includes(query)
    );
  });

  const handleCheckIn = async (pnmId: string) => {
    if (!selectedEventId) {
      toast({ title: "No event selected", description: "Please select an event first" });
      return;
    }
    setCheckingIn(pnmId);
    try {
      await api(`/events/${selectedEventId}/attendance`, {
        method: "POST",
        body: { event_id: selectedEventId, pnm_id: pnmId },
      });
      toast({ title: "Checked in", description: "PNM successfully checked in" });
      setCheckedInIds(new Set([...checkedInIds, pnmId]));
      setTimeout(loadAttendance, 500);
    } catch (e: any) {
      const errorMsg = e?.message || "Check-in failed";
      if (errorMsg.includes("already")) {
        toast({ title: "Already checked in", description: "This PNM is already checked in." });
        setCheckedInIds(new Set([...checkedInIds, pnmId]));
      } else {
        toast({ title: "Check-in failed", description: errorMsg });
      }
    } finally {
      setCheckingIn(null);
    }
  };

  const handleQrScan = (decodedText: string) => {
    if (!selectedEventId) {
      toast({ title: "No event selected", description: "Please select an event first" });
      return;
    }
    // QR code should contain URL format: https://rushrank.app/checkin?p={pnm_id}
    // Or just the PNM ID (for backwards compatibility)
    let pnmId: string | null = null;
    
    const trimmed = decodedText.trim();
    
    // Check if it's a URL format
    if (trimmed.includes("rushrank.app/checkin") || trimmed.includes("/checkin")) {
      try {
        const url = new URL(trimmed);
        pnmId = url.searchParams.get("p");
      } catch (e) {
        // If URL parsing fails, try to extract ID from the string
        const match = trimmed.match(/[?&]p=([^&]+)/);
        pnmId = match ? match[1] : null;
      }
    } else {
      // Assume it's just the PNM ID (backwards compatibility)
      pnmId = trimmed;
    }
    
    if (pnmId) {
      handleCheckIn(pnmId);
    } else {
      toast({ 
        title: "Invalid QR Code", 
        description: "Could not extract PNM ID from QR code. Please try scanning again or use manual entry." 
      });
    }
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-beta-gray hover:text-beta-navy mb-4 min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200 mb-2">
            Check In
          </h2>
        </div>

        {/* Event Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-beta-navy mb-2">
            Select Event
          </label>
          <select
            value={selectedEventId || ""}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="w-full h-12 px-4 rounded-lg border border-beta-gray/60 bg-white dark:bg-black text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy text-base"
          >
            <option value="">-- Select an event --</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
          {selectedEventId && (
            <div className="mt-2 flex items-center gap-2 text-sm text-beta-gray">
              <Users className="h-4 w-4" />
              <span>{attendeeCount} checked in</span>
            </div>
          )}
        </div>

        {!selectedEventId ? (
          <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-black p-8 text-center">
            <p className="text-beta-gray">Please select an event to begin checking in PNMs.</p>
          </div>
        ) : (
          <Tabs defaultValue="qr" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="qr" className="flex-1 min-h-[44px] text-base">
                Scan QR
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 min-h-[44px] text-base">
                Manual List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="mt-4">
              <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-black p-4">
                <QrScanner
                  onScanSuccess={handleQrScan}
                  onClose={() => {}}
                />
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              <div className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-beta-gray" />
                  <input
                    type="text"
                    placeholder="Search by name, major, hometown, or year..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-lg border border-beta-gray/60 bg-white dark:bg-black text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy text-base"
                  />
                </div>

                {/* PNM List */}
                {loading ? (
                  <div className="text-center py-8 text-beta-gray">Loading PNMs...</div>
                ) : filteredPnms.length === 0 ? (
                  <div className="text-center py-8 text-beta-gray">
                    {searchQuery ? "No PNMs found matching your search." : "No PNMs available."}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {filteredPnms.map((pnm) => {
                      const isCheckedIn = checkedInIds.has(pnm.id);
                      return (
                        <div
                          key={pnm.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border border-beta-gray/30 bg-white dark:bg-black p-4",
                            isCheckedIn && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                          )}
                        >
                          <Avatar image={pnm.photo_url || undefined} size="small">
                            {pnm.name.slice(0, 2).toUpperCase()}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-beta-navy truncate">{pnm.name}</div>
                            <div className="text-xs text-beta-gray">
                              {[pnm.major, pnm.year, pnm.hometown].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                          {isCheckedIn ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="text-sm font-medium">Checked In</span>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleCheckIn(pnm.id)}
                              disabled={checkingIn === pnm.id}
                              size="small"
                              className="min-h-[44px] min-w-[100px]"
                            >
                              {checkingIn === pnm.id ? "Checking in..." : "Check In"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

