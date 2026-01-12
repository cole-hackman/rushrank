export type RoundStateMsg = { type: "STATE"; current_pnm_id: string | null; locked: boolean };
export type TallyMsg = { type: "TALLY"; pnm_id: string; yes: number; no: number; unknown: number; favorites: number };
export type AdvanceMsg = { type: "ADVANCE"; pnm_id: string };
export type WSMsg = RoundStateMsg | TallyMsg | AdvanceMsg;

export function subscribeToRound(roundId: string, onMessage: (msg: WSMsg) => void): () => void {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
  const wsUrl = base.replace(/^http/, "ws") + `/ws/rounds/${roundId}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      // ignore
    }
  };
  return () => ws.close();
}

