interface WebSocketMessage {
  type: string;
  data?: any;
}

interface WebSocketCallbacks {
  onRoundState?: (data: any) => void;
  onPNMChanged?: (data: any) => void;
  onVoteUpdate?: (data: any) => void;
  onRoundEnded?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(callbacks: WebSocketCallbacks = {}) {
    this.callbacks = callbacks;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.callbacks.onDisconnect?.();
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'round_state':
        this.callbacks.onRoundState?.(message.data);
        break;
      case 'pnm_changed':
        this.callbacks.onPNMChanged?.(message.data);
        break;
      case 'vote_update':
        this.callbacks.onVoteUpdate?.(message.data);
        break;
      case 'round_ended':
        this.callbacks.onRoundEnded?.(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(this.callbacks);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  send(type: string, data?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected, message not sent:', type, data);
    }
  }

  joinRound(roundId: string, voterId: string, isAdmin = false) {
    this.send('join_round', { roundId, voterId, isAdmin });
  }

  nextPNM() {
    this.send('admin_next_pnm');
  }

  voteSubmitted(data: any) {
    this.send('vote_submitted', data);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsManager = new WebSocketManager();
