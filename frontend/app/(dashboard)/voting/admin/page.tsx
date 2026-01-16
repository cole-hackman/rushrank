"use client";
import { useEffect, useState } from "react";
import { api, getChapterId } from "@/lib/api";
import { Button } from "@/ui/components/Button";
import { useToast } from "@/components/ToastProvider";

type PNMItem = { id: string; name: string };
type Chapter = { id: string; name: string };

export default function VotingAdminPage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pnms, setPnms] = useState<PNMItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [roundId, setRoundId] = useState<string | null>(null);
  const [currentPNM, setCurrentPNM] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
        if (cid) {
          const list = await api<any[]>(`/pnms?chapter_id=${cid}`);
          setPnms(list.map((p) => ({ id: p.id as string, name: p.name as string })));
        }
      } catch (e: any) {
        toast({ title: "Failed to load", description: e.message });
      }
    })();
  }, [toast]);

  async function startRound() {
    if (!chapterId) return;
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (ids.length === 0) {
      toast({ title: "Select at least one PNM" });
      return;
    }
    try {
      const round = await api<any>(`/rounds?chapter_id=${chapterId}`, {
        method: "POST",
        body: { type: "rush", selected_pnm_ids: ids }
      });
      setRoundId(round.id as string);
      toast({ title: "Round started" });
    } catch (e: any) {
      toast({ title: "Failed to start round", description: e.message });
    }
  }

  async function advance() {
    if (!roundId || !currentPNM) return;
    try {
      await api(`/rounds/${roundId}/advance`, { method: "POST", body: { current_pnm_id: currentPNM } });
      toast({ title: "Advanced" });
    } catch (e: any) {
      toast({ title: "Advance failed", description: e.message });
    }
  }

  async function toggleLock(lock: boolean) {
    if (!roundId) return;
    try {
      await api(`/rounds/${roundId}/lock`, { method: "POST", body: { locked: lock } });
      toast({ title: lock ? "Locked" : "Unlocked" });
    } catch (e: any) {
      toast({ title: "Lock toggle failed", description: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Voting Admin</h1>

      <div className="rounded-md border bg-white p-4">
        <h2 className="font-medium mb-2">Start Round</h2>
        <div className="max-h-64 overflow-auto border rounded">
          {pnms.map((p) => (
            <label key={p.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
              <input
                type="checkbox"
                checked={!!selected[p.id]}
                onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
              />
              <span className="text-sm">{p.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Button onClick={startRound} disabled={!chapterId}>Start Round</Button>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <h2 className="font-medium mb-2">Session Controls</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={currentPNM}
            onChange={(e) => setCurrentPNM(e.target.value)}
          >
            <option value="">Select current PNM…</option>
            {pnms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button variant="neutral-secondary" onClick={advance} disabled={!roundId || !currentPNM}>Advance</Button>
          <Button variant="neutral-secondary" onClick={() => toggleLock(true)} disabled={!roundId}>Lock</Button>
          <Button variant="neutral-secondary" onClick={() => toggleLock(false)} disabled={!roundId}>Unlock</Button>
        </div>
      </div>
    </div>
  );
}


