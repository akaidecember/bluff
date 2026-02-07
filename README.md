# Bluffer Clone

## Project status: Work In Progress

This repository is currently an **incomplete project**.

- Core gameplay is under active development.
- UI/UX and game state handling are not final.
- Expect rough edges and missing validations.

## Local development

### Requirements

- Python 3.11+
- Node.js 18+

### Backend (FastAPI)

1. Create and activate a virtual environment
2. Install dependencies:
   - `pip install fastapi uvicorn`
3. Run the server:
   - `uvicorn backend.main:app --reload --port 8000`

### Frontend (React + Vite)

1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Start the dev server:
   - `npm run dev`

Then open the frontend URL shown by Vite (usually `http://localhost:5173`).

## Gameplay quickstart (current WIP behavior)

1. Open the frontend in two browser tabs.
2. Create a room in the first tab.
3. Join the room code in the second tab.
4. Start the game from the host tab.
5. Play turns and test.
