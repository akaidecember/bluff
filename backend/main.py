from __future__ import annotations

from dataclasses import dataclass, field
import asyncio
import json
import logging
import random
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .dev_tools import (
    DEV_MODE_ENV,
    apply_dev_action,
    choose_dev_action,
    is_dev_mode,
    seed_room_for_dev,
)
from .game_engine import GamePhase, TurnDirection
from .rooms import JoinStatus, MIN_PLAYERS, Room, RoomManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bluffer.backend")
app = FastAPI(title="Bluffer Backend")
DEV_MODE = is_dev_mode()

if DEV_MODE:
    logger.info("dev mode enabled via %s", DEV_MODE_ENV)

@dataclass
class ConnectionManager:
    active_connections: Set[WebSocket] = field(default_factory=set)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("client connected (%s active)", len(self.active_connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        logger.info("client disconnected (%s active)", len(self.active_connections))

manager = ConnectionManager()
room_manager = RoomManager()
room_connections: Dict[str, Set[WebSocket]] = {}
connection_rooms: Dict[WebSocket, str] = {}
connection_players: Dict[WebSocket, str] = {}
dev_autoplay_tasks: Dict[str, asyncio.Task] = {}

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "invalid json"})
                continue
            message_type = payload.get("type")

            if message_type and message_type.startswith("dev_") and not DEV_MODE:
                await websocket.send_json(
                    {"type": "error", "message": "dev mode disabled"}
                )
                continue

            if message_type == "create_room":
                player_id = payload.get("player_id")
                display_name = payload.get("display_name")
                deck_count = payload.get("deck_count", 1)
                direction_value = payload.get("direction", TurnDirection.CLOCKWISE.value)

                if not player_id or not display_name:
                    await websocket.send_json(
                        {"type": "error", "message": "player_id and display_name required"}
                    )
                    continue
                try:
                    direction = TurnDirection(direction_value)
                except ValueError:
                    await websocket.send_json(
                        {"type": "error", "message": "invalid direction"}
                    )
                    continue
                try:
                    room = room_manager.create_room(
                        player_id, display_name, int(deck_count), direction
                    )
                except ValueError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue

                room_connections.setdefault(room.code, set()).add(websocket)
                connection_rooms[websocket] = room.code
                connection_players[websocket] = player_id

                await websocket.send_json(
                    {
                        "type": "room_created",
                        "room_code": room.code,
                        "player_id": player_id,
                        "phase": room.game_state.phase.value,
                    }
                )
                await _send_public_state(room.code)
                await _send_private_state(room.code)
                continue

            if message_type == "dev_seed_room":
                player_id = payload.get("player_id")
                display_name = payload.get("display_name")
                player_count = payload.get("player_count", MIN_PLAYERS)
                deck_count = payload.get("deck_count", 1)
                direction_value = payload.get("direction", TurnDirection.CLOCKWISE.value)

                if not player_id or not display_name:
                    await websocket.send_json(
                        {"type": "error", "message": "player_id and display_name required"}
                    )
                    continue
                try:
                    player_count = int(player_count)
                except (TypeError, ValueError):
                    await websocket.send_json(
                        {"type": "error", "message": "player_count must be an integer"}
                    )
                    continue
                try:
                    deck_count = int(deck_count)
                except (TypeError, ValueError):
                    await websocket.send_json(
                        {"type": "error", "message": "deck_count must be an integer"}
                    )
                    continue
                try:
                    direction = TurnDirection(direction_value)
                except ValueError:
                    await websocket.send_json(
                        {"type": "error", "message": "invalid direction"}
                    )
                    continue
                try:
                    room = seed_room_for_dev(
                        room_manager,
                        player_id,
                        display_name,
                        deck_count,
                        direction,
                        player_count,
                    )
                except ValueError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue

                room_connections.setdefault(room.code, set()).add(websocket)
                connection_rooms[websocket] = room.code
                connection_players[websocket] = player_id

                await websocket.send_json(
                    {
                        "type": "room_created",
                        "room_code": room.code,
                        "player_id": player_id,
                        "phase": room.game_state.phase.value,
                        "dev_mode": True,
                    }
                )
                await _send_public_state(room.code)
                await _send_private_state(room.code)
                continue

            if message_type == "join_room":
                room_code = payload.get("room_code")
                player_id = payload.get("player_id")
                display_name = payload.get("display_name")

                if not room_code or not player_id or not display_name:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "room_code, player_id, display_name required",
                        }
                    )
                    continue
                status, room = room_manager.join_room(room_code, player_id, display_name)

                if status == JoinStatus.NOT_FOUND:
                    await websocket.send_json(
                        {
                            "type": "room_not_found", 
                            "room_code": room_code
                        }
                    )
                    continue

                if status == JoinStatus.FULL:
                    await websocket.send_json(
                        {
                            "type": "room_full", 
                            "room_code": room_code
                        }
                    )
                    continue

                if status == JoinStatus.CLOSED:
                    await websocket.send_json(
                        {
                            "type": "room_closed", 
                            "room_code": room_code
                        }
                    )
                    continue

                room_connections.setdefault(room_code, set()).add(websocket)
                connection_rooms[websocket] = room_code
                connection_players[websocket] = player_id
                response_type = (
                    "room_already_joined"
                    if status == JoinStatus.ALREADY_JOINED
                    else "room_joined"
                )

                await websocket.send_json(
                    {
                        "type": response_type,
                        "room_code": room_code,
                        "player_id": player_id,
                        "phase": room.game_state.phase.value,
                    }
                )
                await _send_public_state(room_code)
                await _send_private_state(room_code)
                continue

            if message_type == "start_game":
                room_code = payload.get("room_code")
                player_id = payload.get("player_id")

                if not room_code or not player_id:
                    await websocket.send_json(
                        {
                            "type": "error", 
                            "message": "room_code and player_id required"
                        }
                    )
                    continue
                try:
                    room = room_manager.start_game(room_code, player_id)
                except ValueError as exc:
                    await websocket.send_json(
                        {
                            "type": "invalid_action", 
                            "message": str(exc)
                        }
                    )
                    continue
                await _broadcast_room(
                    room_code,
                    {
                        "type": "game_started",
                        "room_code": room_code,
                        "phase": room.game_state.phase.value,
                    },
                )
                await _send_public_state(room_code)
                await _send_private_state(room_code)

                continue

            if message_type == "dev_autoplay":
                room_code = payload.get("room_code")
                delay_ms = payload.get("delay_ms", 0)
                max_steps = payload.get("max_steps", 5000)
                seed = payload.get("seed")

                if not room_code:
                    await websocket.send_json(
                        {"type": "error", "message": "room_code required"}
                    )
                    continue
                room = room_manager.rooms.get(room_code)

                if room is None:
                    await websocket.send_json(
                        {"type": "room_not_found", "room_code": room_code}
                    )
                    continue

                if room_code in dev_autoplay_tasks and not dev_autoplay_tasks[room_code].done():
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "dev autoplay already running for room",
                        }
                    )
                    continue

                try:
                    delay_ms = int(delay_ms)
                    max_steps = int(max_steps)
                except (TypeError, ValueError):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "delay_ms and max_steps must be integers",
                        }
                    )
                    continue

                task = asyncio.create_task(
                    _run_dev_autoplay(room_code, delay_ms, max_steps, seed)
                )

                dev_autoplay_tasks[room_code] = task
                task.add_done_callback(
                    lambda _: dev_autoplay_tasks.pop(room_code, None)
                )

                await websocket.send_json(
                    {
                        "type": "dev_autoplay_started",
                        "room_code": room_code,
                        "delay_ms": delay_ms,
                        "max_steps": max_steps,
                    }
                )

                continue

            if message_type in {"play_cards", "pass_turn", "call_bluff"}:
                room_code = payload.get("room_code")
                player_id = payload.get("player_id")

                if not room_code or not player_id:
                    await websocket.send_json(
                        {
                            "type": "error", 
                            "message": "room_code and player_id required"
                        }
                    )
                    continue

                if connection_players.get(websocket) != player_id:
                    await websocket.send_json(
                        {
                            "type": "error", 
                            "message": "player_id mismatch"
                        }
                    )
                    continue

                room = room_manager.rooms.get(room_code)

                if room is None:
                    await websocket.send_json(
                        {
                            "type": "room_not_found", 
                            "room_code": room_code
                        }
                    )
                    continue

                try:
                    if message_type == "play_cards":
                        card_indices = payload.get("card_indices", [])
                        claim_rank = payload.get("claim_rank")

                        if not isinstance(card_indices, list) or claim_rank is None:
                            raise ValueError("card_indices and claim_rank required")
                        
                        room.game_state.play_cards(
                            player_id, [int(index) for index in card_indices], str(claim_rank)
                        )

                    elif message_type == "pass_turn":
                        discarded = room.game_state.pass_turn(player_id)

                        if discarded:
                            await _broadcast_room(
                                room_code,
                                {
                                    "type": "pile_discarded",
                                    "room_code": room_code,
                                    "player_id": player_id,
                                },
                            )
                    else:
                        pick_index = payload.get("pick_index")

                        if pick_index is None:
                            raise ValueError("pick_index required")
                        outcome = room.game_state.call_bluff(player_id, int(pick_index))

                        await _broadcast_room(
                            room_code,
                            {
                                "type": "challenge_resolved",
                                "room_code": room_code,
                                "claimant_id": outcome.claimant_id,
                                "challenger_id": outcome.challenger_id,
                                "penalty_player_id": outcome.penalty_player_id,
                                "picked_card": outcome.picked_card.code(),
                                "picked_matches_claim": outcome.picked_matches_claim,
                            },
                        )
                except ValueError as exc:
                    await websocket.send_json(
                        {"type": "invalid_action", "message": str(exc)}
                    )
                    continue
                await _send_public_state(room_code)
                await _send_private_state(room_code)

                continue

            await websocket.send_json(
                {"type": "error", "message": "unknown message type"}
            )
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        room_code = connection_rooms.pop(websocket, None)
        connection_players.pop(websocket, None)

        if room_code:
            room_connections.get(room_code, set()).discard(websocket)

async def _broadcast_room(room_code: str, message: dict) -> None:
    for socket in room_connections.get(room_code, set()):
        await socket.send_json(message)

async def _send_public_state(room_code: str) -> None:
    room = room_manager.rooms.get(room_code)
    if room is None:
        return
    state = _public_state(room)
    await _broadcast_room(room_code, {"type": "public_state", "state": state})

async def _send_private_state(room_code: str) -> None:
    room = room_manager.rooms.get(room_code)

    if room is None:
        return
    
    for socket in room_connections.get(room_code, set()):
        player_id = connection_players.get(socket)

        if not player_id:
            continue

        player = room.players.get(player_id)

        if not player:
            continue

        await socket.send_json(
            {
                "type": "private_state",
                "state": {
                    "room_code": room.code,
                    "player_id": player_id,
                    "hand": [card.code() for card in player.hand],
                },
            }
        )

async def _run_dev_autoplay(
    room_code: str, delay_ms: int, max_steps: int, seed: object
) -> None:
    
    room = room_manager.rooms.get(room_code)

    if room is None:
        return

    rng = random.Random(seed)

    if room.game_state.phase == GamePhase.WAITING_FOR_PLAYERS:
        if not room.can_start():
            await _broadcast_room(
                room_code,
                {
                    "type": "error",
                    "message": f"need at least {MIN_PLAYERS} players to start",
                },
            )
            return
        
        room.start_game()

        await _broadcast_room(
            room_code,
            {
                "type": "game_started",
                "room_code": room_code,
                "phase": room.game_state.phase.value,
            },
        )
        await _send_public_state(room_code)
        await _send_private_state(room_code)

    steps = 0
    while room.game_state.phase != GamePhase.GAME_OVER and steps < max_steps:
        try:
            action = choose_dev_action(room, rng)
            event = apply_dev_action(room, action)
        except ValueError as exc:
            await _broadcast_room(
                room_code,
                {"type": "error", "message": f"dev autoplay error: {exc}"},
            )
            break

        if event is not None:
            await _broadcast_room(room_code, event)

        await _send_public_state(room_code)
        await _send_private_state(room_code)

        steps += 1

        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000)

    await _broadcast_room(
        room_code,
        {
            "type": "dev_autoplay_done",
            "room_code": room_code,
            "steps": steps,
            "phase": room.game_state.phase.value,
            "standings": room.game_state.standings(),
        },
    )

def _public_state(room: Room) -> dict:
    last_claim = None

    if room.game_state.last_claim is not None:
        last_claim = {
            "player_id": room.game_state.last_claim.player_id,
            "rank": room.game_state.last_claim.rank,
            "count": room.game_state.last_claim.count,
        }

    current_player_id = None

    if room.game_state.phase in {GamePhase.PLAYER_TURN, GamePhase.CLAIM_MADE}:
        current_player_id = room.game_state.turn_order[room.game_state.current_turn_index]

    return {
        "room_code": room.code,
        "phase": room.game_state.phase.value,
        "host_id": room.host_id,
        "deck_count": room.deck_count,
        "direction": room.direction.value,
        "players": [
            {
                "player_id": player.player_id,
                "display_name": player.display_name,
                "hand_count": len(player.hand),
            }

            for player in room.players.values()
            
        ],
        "current_player_id": current_player_id,
        "last_claim": last_claim,
        "round_rank": room.game_state.round_rank,
        "round_starter_id": room.game_state.round_starter_id,
        "last_play_count": len(room.game_state.last_played_cards),
        "pile_count": len(room.game_state.pile),
        "discard_pile_count": len(room.game_state.discard_pile),
        "finished_order": list(room.game_state.finished_order),
        "loser_id": room.game_state.loser_id,
        "standings": room.game_state.standings(),
    }
