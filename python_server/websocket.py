"""
WebSocket Manager for RushRank real-time voting updates
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time session updates"""
    
    def __init__(self):
        # session_id -> set of connected websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept and store a new WebSocket connection for a session"""
        await websocket.accept()
        async with self._lock:
            if session_id not in self.active_connections:
                self.active_connections[session_id] = set()
            self.active_connections[session_id].add(websocket)
        logger.info(f"WebSocket connected to session {session_id}. Total connections: {len(self.active_connections.get(session_id, set()))}")
    
    async def disconnect(self, websocket: WebSocket, session_id: str):
        """Remove a WebSocket connection"""
        async with self._lock:
            if session_id in self.active_connections:
                self.active_connections[session_id].discard(websocket)
                if not self.active_connections[session_id]:
                    del self.active_connections[session_id]
        logger.info(f"WebSocket disconnected from session {session_id}")
    
    async def broadcast_to_session(self, session_id: str, message: dict):
        """Broadcast a message to all connections in a session"""
        async with self._lock:
            connections = self.active_connections.get(session_id, set()).copy()
        
        if not connections:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for websocket in connections:
            try:
                await websocket.send_text(message_str)
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected sockets
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    if session_id in self.active_connections:
                        self.active_connections[session_id].discard(ws)
    
    async def broadcast_pnm_advance(self, session_id: str, pnm_id: Optional[str], pnm_data: Optional[dict] = None):
        """Broadcast PNM advance event"""
        await self.broadcast_to_session(session_id, {
            "type": "pnm_advance",
            "current_pnm_id": pnm_id,
            "pnm": pnm_data
        })
    
    async def broadcast_lock_change(self, session_id: str, locked: bool):
        """Broadcast lock state change"""
        await self.broadcast_to_session(session_id, {
            "type": "lock_change",
            "locked": locked
        })
    
    async def broadcast_vote_cast(self, session_id: str, pnm_id: str, tallies: dict):
        """Broadcast vote cast event with updated tallies"""
        await self.broadcast_to_session(session_id, {
            "type": "vote_cast",
            "pnm_id": pnm_id,
            "tallies": tallies
        })
    
    async def broadcast_session_end(self, session_id: str, round_id: str):
        """Broadcast session ended event"""
        await self.broadcast_to_session(session_id, {
            "type": "session_ended",
            "round_id": round_id
        })


# Global connection manager instance
manager = ConnectionManager()
