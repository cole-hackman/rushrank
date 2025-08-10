import { useEffect, useRef } from 'react';
import { wsManager } from '@/lib/websocket';

interface UseWebSocketProps {
  onRoundState?: (data: any) => void;
  onPNMChanged?: (data: any) => void;
  onVoteUpdate?: (data: any) => void;
  onRoundEnded?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({
  onRoundState,
  onPNMChanged,
  onVoteUpdate,
  onRoundEnded,
  onConnect,
  onDisconnect,
}: UseWebSocketProps = {}) {
  const callbacksRef = useRef({
    onRoundState,
    onPNMChanged,
    onVoteUpdate,
    onRoundEnded,
    onConnect,
    onDisconnect,
  });

  // Update callbacks ref when props change
  useEffect(() => {
    callbacksRef.current = {
      onRoundState,
      onPNMChanged,
      onVoteUpdate,
      onRoundEnded,
      onConnect,
      onDisconnect,
    };
  }, [onRoundState, onPNMChanged, onVoteUpdate, onRoundEnded, onConnect, onDisconnect]);

  useEffect(() => {
    wsManager.connect(callbacksRef.current);

    return () => {
      wsManager.disconnect();
    };
  }, []);

  return {
    joinRound: (roundId: string, voterId: string, isAdmin = false) => {
      wsManager.joinRound(roundId, voterId, isAdmin);
    },
    nextPNM: () => {
      wsManager.nextPNM();
    },
    voteSubmitted: (data: any) => {
      wsManager.voteSubmitted(data);
    },
  };
}
