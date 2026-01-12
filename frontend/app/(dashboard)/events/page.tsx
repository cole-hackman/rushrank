"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";

type Event = { id: string; name: string; date: string; location?: string | null; type: string; chapter_id: string };

export default function EventsPage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id;
        setChapterId(cid || null);
        if (cid) {
          const data = await api<Event[]>(`/events?chapter_id=${cid}`);
          setEvents(data);
        }
      } catch (e: any) {
        toast({ title: "Failed to load events", description: e.message });
      }
    })();
  }, [toast]);

  const filtered = events.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  const checkIn = async (eventId: string) => {
    const pnmId = prompt("Enter PNM ID to check-in (QR stub):");
    if (!pnmId) return;
    try {
      await api(`/events/${eventId}/attendance`, { method: "POST", body: { event_id: eventId, pnm_id: pnmId } });
      toast({ title: "Checked in", description: `PNM ${pnmId} checked in` });
    } catch (e: any) {
      toast({ title: "Check-in failed", description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" onClick={() => alert("QR scanner stub")}>Scan QR</Button>
      </div>
      <div className="grid gap-3">
        {filtered.map((ev) => (
          <div key={ev.id} className="rounded-md border bg-white p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{ev.name}</div>
              <div className="text-sm text-gray-600">{new Date(ev.date).toLocaleString()} • {ev.location}</div>
            </div>
            <Button onClick={() => checkIn(ev.id)}>Check-in</Button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-gray-500">No events found.</div>}
      </div>
    </div>
  );
}

