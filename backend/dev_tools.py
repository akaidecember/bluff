from __future__ import annotations

from dataclasses import dataclass, field
import os
import random
from typing import List, Optional

try:
    from .game_engine import GamePhase, RANKS, TurnDirection
    from .rooms import JoinStatus, MAX_PLAYERS, MIN_PLAYERS, Room, RoomManager
except ImportError:  # pragma: no cover fallback for non-package execution
    from game_engine import GamePhase, RANKS, TurnDirection
    from rooms import JoinStatus, MAX_PLAYERS, MIN_PLAYERS, Room, RoomManager

DEV_MODE_ENV = "BLUFFER_DEV_MODE"

def is_dev_mode() -> bool:
    return os.getenv(DEV_MODE_ENV, "").strip().lower() in {"1", "true", "yes", "on"}

def seed_room_for_dev(
    room_manager: RoomManager,
    host_id: str,
    host_name: str,
    deck_count: int,
    direction: TurnDirection,
    player_count: int,
) -> Room:
    
    normalized_count = _validate_player_count(player_count)
    room = room_manager.create_room(host_id, host_name, deck_count, direction)

    for index in range(1, normalized_count):
        bot_id = f"dev-bot-{index}"
        bot_name = f"Bot {index}"
        status = room.add_player(bot_id, bot_name)

        if status != JoinStatus.JOINED:
            raise ValueError(f"failed to add dev bot {bot_id}: {status.value}")

    return room

@dataclass(frozen=True)
class DevAction:
    kind: str
    player_id: str
    card_indices: List[int] = field(default_factory=list)
    claim_rank: Optional[str] = None
    pick_index: Optional[int] = None

def choose_dev_action(room: Room, rng: random.Random) -> DevAction:
    state = room.game_state
    player_id = state.current_player_id()
    hand = state.players[player_id].hand

    if state.phase == GamePhase.CLAIM_MADE:
        if (
            state.last_claim is not None
            and player_id != state.last_claim.player_id
            and state.last_played_cards
            and rng.random() < 0.25
        ):
            pick_index = rng.randrange(len(state.last_played_cards))

            return DevAction(kind="call_bluff", player_id=player_id, pick_index=pick_index)
        
        return _make_play_action(player_id, hand, rng, state.round_rank)

    if state.phase == GamePhase.PLAYER_TURN:
        if state.last_claim is not None and rng.random() < 0.1:
            return DevAction(kind="pass_turn", player_id=player_id)
        
        return _make_play_action(player_id, hand, rng, state.round_rank)

    return DevAction(kind="pass_turn", player_id=player_id)

def apply_dev_action(room: Room, action: DevAction) -> Optional[dict]:
    if action.kind == "play_cards":
        room.game_state.play_cards(
            action.player_id,
            list(action.card_indices),
            str(action.claim_rank or RANKS[0]),
        )
        return None

    if action.kind == "pass_turn":
        discarded = room.game_state.pass_turn(action.player_id)

        if discarded:
            return {
                "type": "pile_discarded",
                "room_code": room.code,
                "player_id": action.player_id,
            }
        
        return None

    if action.kind == "call_bluff":
        pick_index = int(action.pick_index or 0)
        outcome = room.game_state.call_bluff(action.player_id, pick_index)

        return {
            "type": "challenge_resolved",
            "room_code": room.code,
            "claimant_id": outcome.claimant_id,
            "challenger_id": outcome.challenger_id,
            "penalty_player_id": outcome.penalty_player_id,
            "picked_card": outcome.picked_card.code(),
            "picked_matches_claim": outcome.picked_matches_claim,
        }

    raise ValueError(f"unknown dev action {action.kind}")

def _validate_player_count(player_count: int) -> int:

    if player_count < MIN_PLAYERS or player_count > MAX_PLAYERS:
        raise ValueError(
            f"player_count must be between {MIN_PLAYERS} and {MAX_PLAYERS}"
        )
    return player_count

def _make_play_action(
    player_id: str,
    hand: List,
    rng: random.Random,
    locked_rank: Optional[str],
) -> DevAction:
    
    if not hand:
        return DevAction(kind="pass_turn", player_id=player_id)

    count = rng.randint(1, min(3, len(hand)))
    indices = rng.sample(range(len(hand)), count)
    claim_rank = locked_rank or rng.choice(RANKS)
    
    return DevAction(
        kind="play_cards",
        player_id=player_id,
        card_indices=indices,
        claim_rank=claim_rank,
    )
