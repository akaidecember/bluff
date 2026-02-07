from __future__ import annotations

from dataclasses import dataclass, field
import json
import logging
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .game_engine import GamePhase, TurnDirection
from .rooms import JoinStatus, Room, RoomManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bluffer.backend")

app = FastAPI(title="Bluffer Backend")


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
                        {"type": "room_not_found", "room_code": room_code}
                    )
                    continue
                if status == JoinStatus.FULL:
                    await websocket.send_json(
                        {"type": "room_full", "room_code": room_code}
                    )
                    continue
                if status == JoinStatus.CLOSED:
                    await websocket.send_json(
                        {"type": "room_closed", "room_code": room_code}
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
                        {"type": "error", "message": "room_code and player_id required"}
                    )
                    continue
                try:
                    room = room_manager.start_game(room_code, player_id)
                except ValueError as exc:
                    await websocket.send_json(
                        {"type": "invalid_action", "message": str(exc)}
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

            if message_type in {"play_cards", "pass_turn", "call_bluff"}:
                room_code = payload.get("room_code")
                player_id = payload.get("player_id")
                if not room_code or not player_id:
                    await websocket.send_json(
                        {"type": "error", "message": "room_code and player_id required"}
                    )
                    continue
                if connection_players.get(websocket) != player_id:
                    await websocket.send_json(
                        {"type": "error", "message": "player_id mismatch"}
                    )
                    continue
                room = room_manager.rooms.get(room_code)
                if room is None:
                    await websocket.send_json(
                        {"type": "room_not_found", "room_code": room_code}
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
