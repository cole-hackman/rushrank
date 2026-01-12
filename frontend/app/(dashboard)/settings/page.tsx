"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";

type Round = { id: string; settings: any };

export default function SettingsPage() {
  const { toast } = useToast();
  const [round, setRound] = useState<Round | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [swipeMode, setSwipeMode] = useState(true);
  const [timerSecs, setTimerSecs] = useState(30);
  const [execWeight, setExecWeight] = useState(1.0);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string }[]>("/chapters");
        const cid = chapters[0]?.id;
        const active = await api<any | null>(`/rounds/active?chapter_id=${cid}`);
        if (active?.id) {
          setRound(active);
          const s = active.settings || {};
          setAnonymous(!!s.anonymous);
          setSwipeMode(!!s.swipeMode);
          setTimerSecs(Number(s.timerSecs ?? 30));
          setExecWeight(Number(s.execWeight ?? 1.0));
        }
      } catch (e: any) {
        toast({ title: "Failed to load settings", description: e.message });
      }
    })();
  }, [toast]);

  const save = async () => {
    if (!round) return;
    try {
      await api(`/rounds?chapter_id=${round.settings?.chapter_id || ""}`, {
        method: "POST",
        body: {
          type: "GENERAL",
          selected_pnm_ids: [],
          settings: { anonymous, swipeMode, timerSecs, execWeight }
        }
      });
      toast({ title: "Settings applied", description: "New round started with settings" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message });
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-md border bg-white p-4">
        <div className="font-semibold mb-2">Round Settings</div>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Anonymous Voting
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={swipeMode} onChange={(e) => setSwipeMode(e.target.checked)} />
            Swipe Mode
          </label>
          <div className="flex items-center gap-2">
            <span className="w-40 text-sm">Timer Seconds</span>
            <Input type="number" value={timerSecs} onChange={(e) => setTimerSecs(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-40 text-sm">Exec Weight</span>
            <Input type="number" step="0.1" value={execWeight} onChange={(e) => setExecWeight(Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={save}>Save (start new round)</Button>
        </div>
      </div>
    </div>
  );
}

