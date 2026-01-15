# Python Connectors

This folder contains Python utilities for integrating the Rust trading engine with external systems.

## Planned Components

### 1. gRPC Client (`client.py`)
Connect to the Rust engine to:
- Get current state (positions, P&L, active strategies)
- Start/stop strategies
- Adjust risk limits

### 2. Dashboard Connector (`dashboard.py`)
Bridge to the main [poly dashboard](../../poly):
- Stream trade events to the dashboard WebSocket
- Sync position data
- Forward analytics

### 3. Notification Service (`notifications.py`)
Send alerts via Slack/Discord:
- Trade execution notifications
- Daily P&L summaries
- Error alerts

## Usage (Future)

```python
from poly_rust_client import TradingEngineClient

# Connect to Rust engine
client = TradingEngineClient("localhost:50051")

# Get state
state = client.get_state()
print(f"Daily P&L: ${state.daily_pnl:.2f}")

# Control strategies
client.enable_strategy("clipper")
client.disable_strategy("sniper")
```

## Requirements

```
grpcio>=1.60.0
grpcio-tools>=1.60.0
protobuf>=4.25.0
```

## TODO

- [ ] Define protobuf schema in `proto/trading.proto`
- [ ] Generate Python stubs
- [ ] Implement gRPC client
- [ ] Add dashboard WebSocket bridge
