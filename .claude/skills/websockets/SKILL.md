---
name: websockets
description: Implement real-time features with WebSockets. Use when building chat, notifications, live updates, or real-time collaboration.
allowed-tools: Read, Write, Grep, Glob
---

# WebSockets

## When to Use WebSockets

### Good Use Cases
- Chat applications
- Live notifications
- Real-time collaboration
- Live dashboards
- Gaming

### Consider Alternatives
- Infrequent updates → Polling
- Server-sent only → Server-Sent Events (SSE)
- One-time requests → Regular HTTP

## Basic Implementation

### Server (Node.js with ws)
```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    handleMessage(ws, message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, message) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'subscribe':
      // Handle subscription
      break;
  }
}
```

### Client
```javascript
const ws = new WebSocket('wss://example.com/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'updates' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};

ws.onclose = () => {
  console.log('Disconnected');
  // Implement reconnection logic
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## Common Patterns

### Room/Channel Management
```javascript
const rooms = new Map();

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(ws);
  ws.rooms = ws.rooms || new Set();
  ws.rooms.add(roomId);
}

function leaveRoom(ws, roomId) {
  rooms.get(roomId)?.delete(ws);
  ws.rooms?.delete(roomId);
}

function broadcastToRoom(roomId, message, exclude = null) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
```

### Heartbeat/Keep-Alive
```javascript
// Server
const HEARTBEAT_INTERVAL = 30000;

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Client
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

### Reconnection Logic
```javascript
class ReconnectingWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectDelay = 1000;
    this.maxDelay = 30000;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxDelay
      );
    };
  }
}
```

## Message Protocol

### Standard Message Format
```javascript
// Message structure
{
  type: 'message_type',
  payload: { /* data */ },
  id: 'unique_id',        // For acknowledgment
  timestamp: 1234567890
}

// Types
{ type: 'subscribe', payload: { channel: 'updates' } }
{ type: 'unsubscribe', payload: { channel: 'updates' } }
{ type: 'message', payload: { text: 'Hello' } }
{ type: 'ack', payload: { id: 'original_message_id' } }
{ type: 'error', payload: { code: 'INVALID', message: '...' } }
```

## Security

### Authentication
```javascript
// Option 1: Token in connection URL (less secure)
const ws = new WebSocket('wss://example.com/ws?token=xxx');

// Option 2: Authenticate after connection (preferred)
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { token: getAccessToken() }
  }));
};
```

### Validation
```javascript
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    if (!isValidMessage(message)) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message' } }));
      return;
    }
    // Process message
  } catch {
    ws.close(1003, 'Invalid JSON');
  }
});
```

## WebSocket Checklist

- [ ] Heartbeat/ping-pong implemented
- [ ] Reconnection logic on client
- [ ] Authentication before accepting messages
- [ ] Message validation
- [ ] Proper cleanup on disconnect
- [ ] Rate limiting for messages
- [ ] Error handling for malformed data
