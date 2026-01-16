"use client";
/**
 * Event Check-In Page
 * 
 * Mobile-first check-in interface with:
 * - Large search input for PNM name/ID
 * - QR scanner option
 * - Live attendee count
 * - Recent check-ins list
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { QrScanner } from "@/components/events/QrScanner";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Search, QrCode, ArrowLeft, Users, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
};

type Attendance = {
  id: string;
  pnm_id: string;
  checked_in_at: string | null;
  checked_in_by?: string | null;
  notes?: string | null;
  pnm_name?: string;
  pnm_photo_url?: string | null;
};

export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PNM[]>([]);
  const [searching, setSearching] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [recentCheckIns, setRecentCheckIns] = useState<Attendance[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e?.message });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (eventId && chapterId) {
      loadEvent();
      loadAttendance();
      // Poll attendance every 3 seconds
      const interval = setInterval(loadAttendance, 3000);
      return () => clearInterval(interval);
    }
  }, [eventId, chapterId]);

  const loadEvent = async () => {
    if (!chapterId) return;
    try {
      const events = await api<Event[]>(`/events?chapter_id=${chapterId}`);
      const found = events.find((e) => e.id === eventId);
      if (found) {
        setEvent(found);
      } else {
        toast({ title: "Event not found", description: "The event may have been deleted." });
        router.push("/events");
      }
    } catch (e: any) {
      toast({ title: "Failed to load event", description: e?.message });
    }
  };

  const loadAttendance = async () => {
    if (!eventId) return;
    try {
      const attendance = await api<Attendance[]>(`/events/${eventId}/attendance`);
      setAttendeeCount(attendance.length);
      setRecentCheckIns(attendance.slice(0, 10)); // Last 10 check-ins
    } catch (e: any) {
      console.error("Failed to load attendance:", e);
      // Fallback: try to get count from error or set to 0
      setAttendeeCount(0);
      setRecentCheckIns([]);
    }
  };

  const searchPnms = async (query: string) => {
    if (!chapterId || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const pnms = await api<PNM[]>(`/pnms?chapter_id=${chapterId}&search=${encodeURIComponent(query.trim())}`);
      setSearchResults(pnms);
    } catch (e: any) {
      toast({ title: "Search failed", description: e?.message });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      searchPnms(value);
    } else {
      setSearchResults([]);
    }
  };

  const handleCheckIn = async (pnmId: string) => {
    if (!eventId) return;
    setCheckingIn(pnmId);
    try {
      await api(`/events/${eventId}/attendance`, {
        method: "POST",
        body: { event_id: eventId, pnm_id: pnmId },
      });
      toast({ title: "Checked in", description: "PNM successfully checked in" });
      setSearchQuery("");
      setSearchResults([]);
      // Refresh attendance
      setTimeout(loadAttendance, 500);
    } catch (e: any) {
      const errorMsg = e?.message || "Check-in failed";
      if (errorMsg.includes("already")) {
        toast({ title: "Already checked in", description: "This PNM is already checked in." });
      } else {
        toast({ title: "Check-in failed", description: errorMsg });
      }
    } finally {
      setCheckingIn(null);
    }
  };

  const handleQrScan = (decodedText: string) => {
    // QR code should contain URL format: https://rushrank.app/checkin?p={pnm_id}
    // Or just the PNM ID (for backwards compatibility)
    let pnmId: string | null = null;

    const trimmed = decodedText.trim();

    // Check if it's a URL format
    if (trimmed.includes("rushrank.app/checkin")) {
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
      setShowQrScanner(false);
    } else {
      toast({
        title: "Invalid QR Code",
        description: "Could not extract PNM ID from QR code. Please try scanning again or use manual entry."
      });
    }
  };

  if (!event) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-beta-gray">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-beta-gray/30 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/events")}
            className="rounded-lg p-2 text-beta-gray hover:bg-beta-navy/10 hover:text-beta-navy"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-beta-navy">{event.name}</h1>
            <p className="text-xs text-beta-gray">
              {new Date(event.date).toLocaleDateString()} • {event.location || "No location"}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-beta-navy/10 px-3 py-1.5">
            <Users className="h-4 w-4 text-beta-navy" />
            <span className="text-sm font-semibold text-beta-navy">{attendeeCount}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 p-4">
        {/* Search Section */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <TextField variant="filled" icon={<Search className="h-5 w-5 text-beta-gray" />}>
                <TextField.Input
                  placeholder="Search PNM name or ID..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="text-base py-3" // Larger touch target
                />
              </TextField>
            </div>
            <Button
              variant={showQrScanner ? "brand-primary" : "neutral-secondary"}
              icon={<QrCode className="h-5 w-5" />}
              onClick={() => setShowQrScanner(!showQrScanner)}
              className="min-w-[60px]"
            >
              QR
            </Button>
          </div>

          {showQrScanner && (
            <div className="rounded-xl border border-beta-gray/30 bg-white p-4">
              <QrScanner
                onScanSuccess={handleQrScan}
                onClose={() => setShowQrScanner(false)}
              />
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-beta-gray">Search Results</h2>
            {searchResults.map((pnm) => (
              <div
                key={pnm.id}
                className="flex items-center gap-3 rounded-lg border border-beta-gray/30 bg-white p-4"
              >
                <Avatar image={pnm.photo_url || undefined} size="small">
                  {pnm.name.slice(0, 2).toUpperCase()}
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold text-beta-navy">{pnm.name}</div>
                  {pnm.major && <div className="text-xs text-beta-gray">{pnm.major}</div>}
                </div>
                <Button
                  onClick={() => handleCheckIn(pnm.id)}
                  disabled={checkingIn === pnm.id}
                  size="small"
                >
                  {checkingIn === pnm.id ? "Checking in..." : "Check In"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Recent Check-Ins */}
        {recentCheckIns.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-beta-gray">Recent Check-Ins</h2>
            {recentCheckIns.map((attendance) => (
              <div
                key={attendance.id}
                className="flex items-center gap-3 rounded-lg border border-beta-gray/30 bg-white p-3"
              >
                <Avatar image={attendance.pnm_photo_url || undefined} size="small">
                  {attendance.pnm_name?.slice(0, 2).toUpperCase() || "?"}
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium text-beta-navy">{attendance.pnm_name}</div>
                  <div className="text-xs text-beta-gray">
                    {attendance.checked_in_at
                      ? new Date(attendance.checked_in_at).toLocaleTimeString()
                      : "Just now"}
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {searchQuery.trim().length === 0 && searchResults.length === 0 && recentCheckIns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <QrCode className="h-12 w-12 text-beta-gray/40 mb-3" />
            <p className="text-sm text-beta-gray">Search for a PNM or scan a QR code to check in</p>
          </div>
        )}
      </div>
    </div>
  );
}

