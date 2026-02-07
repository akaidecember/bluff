# Bluff

Bluff is a multiplayer bluff card game built with:

- Backend: FastAPI + WebSocket
- Frontend: React + Vite + TypeScript

This project is currently a **work in progress**.

## Documentation Index

- `docs/GAMEPLAY.md`: Full game rules and flow.
- `docs/API.md`: HTTP + WebSocket API reference with message schemas.
- `docs/ARCHITECTURE.md`: System architecture and code structure.
- `docs/UML.md`: UML diagrams (Mermaid).
- `docs/WIREFRAME.md`: Frontend wireframes/layout references.

## Requirements

- Python 3.11+
- Node.js 18+
- npm 9+

## Run Locally

### 1. Backend

From repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

### 2. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (default `http://127.0.0.1:5173`).

Optional WebSocket URL override:

```bash
VITE_WS_URL=ws://127.0.0.1:8000/ws npm run dev
```

## Quick Start (Play Test)

1. Open the frontend in two browser windows or tabs.
2. In tab A, set player identity and click `Create Room`.
3. Copy room code from tab A.
4. In tab B, enter same room code and click `Join Room`.
5. Host (tab A) clicks `Start Game`.
6. Play cards, pass, and challenge bluff via `Call`.

## Current Game Behavior Summary

- Players: 2 to 6.
- Deck count: 1 or 2.
- Each deck includes 2 jokers (`JKR`, `JKB`).
- Cards are shuffled and evenly distributed round-robin.
- Claim rank is locked per round after first claim.
- Jokers are wildcards when validating bluff.
- If round starter gets turn again and passes, center pile is discarded from play.
- Game ranks players by finishing order; last remaining player with cards is loser.

Detailed rules: `docs/GAMEPLAY.md`.

## Project Layout

```text
backend/
  main.py           # FastAPI app + WebSocket handler
  rooms.py          # Room lifecycle, deck build, dealing
  game_engine.py    # Core game rules and state machine
frontend/
  src/App.tsx       # Top-level UI and WebSocket integration
  src/screens/Lobby.tsx
  src/screens/Game.tsx
  src/types/messages.ts
  public/cards/     # SVG card assets
docs/
  *.md              # Project documentation
```

## Notes

- The UI and balancing values (card overlap, spacing, animations) are still being tuned.
- API is currently unauthenticated and room memory is in-process (no database).
