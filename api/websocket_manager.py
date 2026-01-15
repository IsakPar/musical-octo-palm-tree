"""
WebSocket connection manager for real-time updates.
Broadcasts bot updates to all connected clients.
"""

import json
import asyncio
from datetime import datetime
from typing import Set
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and broadcasts messages to all clients."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        print(f"[WS] Client connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        async with self._lock:
            self.active_connections.discard(websocket)
        print(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        if not self.active_connections:
            return

        message_json = json.dumps(message, default=str)
        disconnected = set()

        async with self._lock:
            for connection in self.active_connections:
                try:
                    await connection.send_text(message_json)
                except Exception:
                    disconnected.add(connection)

            # Clean up disconnected clients
            self.active_connections -= disconnected

    async def broadcast_state_update(self, bot_name: str, state: dict):
        """Broadcast a state update for a specific bot."""
        await self.broadcast({
            "type": "state_update",
            "bot": bot_name,
            "timestamp": datetime.utcnow().isoformat(),
            "data": state
        })

    async def broadcast_trade(self, bot_name: str, trade: dict):
        """Broadcast a new trade event."""
        await self.broadcast({
            "type": "trade",
            "bot": bot_name,
            "timestamp": datetime.utcnow().isoformat(),
            "data": trade
        })

    async def broadcast_opportunity(self, bot_name: str, opportunity: dict):
        """Broadcast a detected opportunity."""
        await self.broadcast({
            "type": "opportunity",
            "bot": bot_name,
            "timestamp": datetime.utcnow().isoformat(),
            "data": opportunity
        })

    async def broadcast_price_update(self, bot_name: str, prices: dict):
        """Broadcast price updates for charts."""
        await self.broadcast({
            "type": "price_update",
            "bot": bot_name,
            "timestamp": datetime.utcnow().isoformat(),
            "data": prices
        })


# Global instance
manager = ConnectionManager()
