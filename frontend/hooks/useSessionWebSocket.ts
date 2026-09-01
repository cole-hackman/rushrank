import { useEffect, useRef, useCallback, useState } from "react";
import { API_BASE } from "@/lib/api";

type PNM = {
  id: string;
  name: string;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  tags?: string[];
};

type SessionMessage = {
  type: "pnm_advance" | "lock_change" | "vote_cast" | "session_ended";
  current_pnm_id?: string | null;
  pnm?: PNM | null;
  locked?: boolean;
  pnm_id?: string;
  tallies?: {
    yes: number;
    no: number;
    unknown: number;
    favorites: number;
    // How many distinct members have voted in this round -- drives the chair's
    // progress bar, which was previously frozen at whatever it was when the
    // session was created.
    votes_collected?: number;
  };
  round_id?: string;
};

type UseSessionWebSocketProps = {
  sessionId: string | null;
  onPnmAdvance?: (pnmId: string | null, pnm: PNM | null) => void;
  onLockChange?: (locked: boolean) => void;
  onVoteCast?: (pnmId: string, tallies: SessionMessage["tallies"]) => void;
  onSessionEnd?: (roundId: string) => void;
  enabled?: boolean;
};

/**
 * Where the session socket lives.
 *
 * The backend mounts `/ws/session/{id}` on the same origin as `/api`, so the
 * socket base is derived from the API base -- one env var to get right instead
 * of two.
 *
 * This used to read `NEXT_PUBLIC_WS_BASE_URL` and nothing else. That variable is
 * set in no `.env.example`, no deployment doc and no CI config, so in production
 * it fell through to `window.location.origin` -- the Vercel domain, which serves
 * no websocket. The socket never connected, and the "live" session quietly ran
 * on the 5-second fallback poll instead, which refreshes only the current PNM:
 * tallies, lock state and session-end never arrived.
 *
 * The override is kept for deployments that terminate websockets elsewhere.
 */
function getWsBase(): string {
  const override = process.env.NEXT_PUBLIC_WS_BASE_URL;
  if (override) return override.replace(/\/+$/, "");
  return API_BASE.replace(/\/api$/, "").replace(/^http/, "ws");
}

export function useSessionWebSocket({
  sessionId,
  onPnmAdvance,
  onLockChange,
  onVoteCast,
  onSessionEnd,
  enabled = true,
}: UseSessionWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers live in a ref so re-rendering the voting page does not change the
  // identity of `connect`.
  //
  // `connect` used to list the handler props in its dependency array. On the
  // voting page `onLockChange` closes over the whole session object and
  // `onVoteCast` calls setSession on every vote -- so every broadcast vote
  // produced new handler identities, a new `connect`, and an effect re-run that
  // tore the socket down and rebuilt it. With a room full of brothers voting
  // that is a reconnect storm. It was invisible only because the socket never
  // connected at all (see getWsBase).
  const handlersRef = useRef({ onPnmAdvance, onLockChange, onVoteCast, onSessionEnd });
  useEffect(() => {
    handlersRef.current = { onPnmAdvance, onLockChange, onVoteCast, onSessionEnd };
  });

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    // A socket for this session is already live or on its way up.
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsUrl = `${getWsBase()}/ws/session/${sessionId}`;

    try {
      intentionalCloseRef.current = false;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return;

          const message: SessionMessage = JSON.parse(event.data);
          const handlers = handlersRef.current;

          switch (message.type) {
            case "pnm_advance":
              handlers.onPnmAdvance?.(message.current_pnm_id || null, message.pnm || null);
              break;
            case "lock_change":
              if (message.locked !== undefined) {
                handlers.onLockChange?.(message.locked);
              }
              break;
            case "vote_cast":
              if (message.pnm_id && message.tallies) {
                handlers.onVoteCast?.(message.pnm_id, message.tallies);
              }
              break;
            case "session_ended":
              if (message.round_id) {
                handlers.onSessionEnd?.(message.round_id);
              }
              break;
          }
        } catch (e) {
          console.error("[WS] Failed to parse message:", e);
        }
      };

      ws.onerror = () => {
        setError("WebSocket error occurred");
      };

      ws.onclose = (event) => {
        setConnected(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        // Reconnect unless we closed it ourselves (unmount, tab change, or the
        // session going away).
        if (!intentionalCloseRef.current && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.error("[WS] Failed to connect:", e);
      setError("Failed to establish WebSocket connection");
    }
  }, [sessionId, enabled]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, "Component unmounted");
      wsRef.current = null;
    }

    setConnected(false);
  }, [clearTimers]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    error,
    disconnect,
    reconnect: connect,
  };
}
