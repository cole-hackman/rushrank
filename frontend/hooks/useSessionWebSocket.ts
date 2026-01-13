import { useEffect, useRef, useCallback, useState } from "react";

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

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL || 
  (typeof window !== "undefined" && window.location.origin.replace(/^http/, "ws").replace(":3000", ":8000")) ||
  "ws://localhost:8000";

export function useSessionWebSocket({
  sessionId,
  onPnmAdvance,
  onLockChange,
  onVoteCast,
  onSessionEnd,
  enabled = true,
}: UseSessionWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    const wsUrl = `${WS_BASE}/ws/session/${sessionId}`;
    console.log("[WS] Connecting to:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to session:", sessionId);
        setConnected(true);
        setError(null);

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          // Handle pong responses
          if (event.data === "pong") return;

          const message: SessionMessage = JSON.parse(event.data);
          console.log("[WS] Received message:", message);

          switch (message.type) {
            case "pnm_advance":
              onPnmAdvance?.(message.current_pnm_id || null, message.pnm || null);
              break;
            case "lock_change":
              if (message.locked !== undefined) {
                onLockChange?.(message.locked);
              }
              break;
            case "vote_cast":
              if (message.pnm_id && message.tallies) {
                onVoteCast?.(message.pnm_id, message.tallies);
              }
              break;
            case "session_ended":
              if (message.round_id) {
                onSessionEnd?.(message.round_id);
              }
              break;
          }
        } catch (e) {
          console.error("[WS] Failed to parse message:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("[WS] Error:", event);
        setError("WebSocket error occurred");
      };

      ws.onclose = (event) => {
        console.log("[WS] Disconnected:", event.code, event.reason);
        setConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after 3 seconds if not a clean close
        if (event.code !== 1000 && enabled && sessionId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WS] Attempting to reconnect...");
            connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.error("[WS] Failed to connect:", e);
      setError("Failed to establish WebSocket connection");
    }
  }, [sessionId, enabled, onPnmAdvance, onLockChange, onVoteCast, onSessionEnd]);

  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, "Component unmounted");
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

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
