# Architecture Guide

## High-Level Overview

The project is a real-time multiplayer card game with:

- FastAPI backend for room + game state authority
- React frontend for lobby and game table UI
- WebSocket channel for bi-directional event/state sync

Backend is authoritative; frontend is a state renderer + command sender.

## Backend Architecture

Key modules:

- `backend/main.py`
- FastAPI app
- WebSocket endpoint (`/ws`)
- Connection/session maps
- Broadcast/public/private state dispatch
- `backend/rooms.py`
- Room creation/join/start
- Deck construction and shuffling
- Dealing hands
- `backend/game_engine.py`
- Core game rules/state machine
- Turn progression
- Bluff resolution
- Standings/endgame logic

### Core State Model

`GameState` stores:

- phase
- players and hands
- turn order/index
- direction
- claim state (`last_claim`, `round_rank`, `round_starter_id`)
- pile and discard pile
- finishing order and loser

### Room and Connections

In-memory maps in `backend/main.py`:

- `room_connections[room_code] -> Set[WebSocket]`
- `connection_rooms[socket] -> room_code`
- `connection_players[socket] -> player_id`

No persistent storage is used currently.

## Frontend Architecture

Key modules:

- `frontend/src/App.tsx`
- Manages socket lifecycle and top-level screen switch.
- `frontend/src/lib/ws.ts`
- Thin WebSocket client wrapper (`connect`, `send`, subscriptions).
- `frontend/src/screens/Lobby.tsx`
- Room creation/join/start UI.
- `frontend/src/screens/Game.tsx`
- Main table rendering, controls, hand interactions.
- `frontend/src/types/messages.ts`
- Shared message/state TypeScript contracts.

## Data Flow

1. Frontend sends command message (`create_room`, `play_cards`, etc).
2. Backend validates + mutates `GameState`.
3. Backend broadcasts fresh `public_state`.
4. Backend sends per-player `private_state` (their hand only).
5. Frontend updates UI from server state.

## Game State Machine

Phases:

- `WAITING_FOR_PLAYERS`
- `DEALING`
- `PLAYER_TURN`
- `CLAIM_MADE`
- `GAME_OVER`

Transitions (simplified):

- waiting -> dealing (`start_game`)
- dealing -> player_turn (`set_dealt_hands`)
- player_turn -> claim_made (`play_cards`)
- claim_made -> player_turn (`call_bluff` or round-starter pass reset)
- any active phase -> game_over (remaining players logic)

## UI Layout Model (Current)

Game table has:

- Top HUD (room, turn badge, last claim)
- Opponent fans arranged by seat geometry
- Center pile stack
- Fixed-height local hand slab:
- left compact rank selector
- center stacked card rows
- right action button stack

## Known Constraints

- In-memory state only (restart clears rooms/games).
- No auth/token model.
- Single backend process authority assumed.
- Protocol is schema-driven by TypeScript types and backend checks, not OpenAPI.

## Extension Points

- Add persistence (Redis/Postgres) for rooms and sessions.
- Add auth/session tokens.
- Add reconnection and state resync semantics.
- Add AI/bot players.
- Add telemetry and structured logging.
