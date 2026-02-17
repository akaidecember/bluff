# Bluff

<img width="1387" height="909" alt="image" src="https://github.com/user-attachments/assets/48a9ce54-0d40-4aeb-8094-135ba10f84a6" />

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

## Deploy Free (Render)

This repo includes a Render blueprint at `render.yaml` that deploys:

- `bluff-backend` (FastAPI WebSocket backend)
- `bluff-frontend` (Vite static site)

### 1. Push this repo to GitHub

Render deploys from your Git repository, so make sure your latest code is pushed.

### 2. Create services from blueprint

1. In Render, click `New +` -> `Blueprint`.
2. Connect your GitHub repo.
3. Render will detect `render.yaml` and create both services.

### 3. Configure frontend WebSocket URL

The frontend must know your backend WebSocket URL.

1. Wait until backend is created and note its URL, for example:
   `https://bluff-backend.onrender.com`
2. In Render -> `bluff-frontend` -> `Environment`, set:
   `VITE_WS_URL=wss://bluff-backend.onrender.com/ws`
3. Redeploy the frontend service.

You can also use `frontend/.env.example` as reference for this variable.

### 4. Verify deployment

1. Check backend health:
   `https://<your-backend-host>/health`
2. Open your frontend URL and create/join a room from two tabs.

### Notes on free tier

- Free web services can sleep after inactivity, so the first connection may take a short time.
- Room state is in memory, so all rooms reset when the backend restarts.

## Quick Start (Play Test)

1. Open the frontend in two browser windows or tabs.
2. In tab A, set player identity and click `Create Room`.
3. Copy room code from tab A.
4. In tab B, enter same room code and click `Join Room`.
5. Host (tab A) clicks `Start Game`.
6. Play cards, pass, and challenge bluff via `Call`.

## Dev Simulation (Hidden)

For automated testing runs (no UI), use the built-in simulator:

```bash
python -m backend.dev_simulation --players 4 --games 3 --deck-count 1
```

For dev-only WebSocket automation, start the backend with:

```bash
BLUFFER_DEV_MODE=1 uvicorn backend.main:app --reload --port 8000
```

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
