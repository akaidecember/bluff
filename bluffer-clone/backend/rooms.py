from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import secrets
import string
from typing import Dict, List, Optional, Tuple

from game_engine import GamePhase, GameState, Player


ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits
DICE_PER_PLAYER = 5
DICE_FACES = 6


class JoinStatus(str, Enum):
    JOINED = "JOINED"
    ALREADY_JOINED = "ALREADY_JOINED"
    FULL = "FULL"
    NOT_FOUND = "NOT_FOUND"
    CLOSED = "CLOSED"


@dataclass
class Room:
    code: str
    max_players: int = 2
    players: Dict[str, Player] = field(default_factory=dict)
    join_order: List[str] = field(default_factory=list)
    game_state: GameState = field(default_factory=GameState)

    def is_full(self) -> bool:
        return len(self.players) >= self.max_players

    def add_player(self, player_id: str, display_name: str) -> JoinStatus:
        if player_id in self.players:
            return JoinStatus.ALREADY_JOINED
        if self.is_full():
            return JoinStatus.FULL
        if self.game_state.phase != GamePhase.WAITING_FOR_PLAYERS:
            return JoinStatus.CLOSED
        player = Player(player_id=player_id, display_name=display_name)
        self.players[player_id] = player
        self.join_order.append(player_id)
        self.game_state.add_player(player)
        if self.is_full():
            self.game_state.start_game(self.join_order)
            hands = self._deal_dice()
            self.game_state.set_dealt_hands(hands)
        return JoinStatus.JOINED

    def _deal_dice(self) -> Dict[str, List[int]]:
        system_random = secrets.SystemRandom()
        hands: Dict[str, List[int]] = {}
        for player_id in self.join_order:
            hands[player_id] = [
                system_random.randint(1, DICE_FACES) for _ in range(DICE_PER_PLAYER)
            ]
        return hands


@dataclass
class RoomManager:
    rooms: Dict[str, Room] = field(default_factory=dict)

    def create_room(self, player_id: str, display_name: str) -> Room:
        code = self._unique_code()
        room = Room(code=code)
        room.add_player(player_id, display_name)
        self.rooms[code] = room
        return room

    def join_room(
        self, room_code: str, player_id: str, display_name: str
    ) -> Tuple[JoinStatus, Optional[Room], bool]:
        room = self.rooms.get(room_code)
        if room is None:
            return JoinStatus.NOT_FOUND, None, False
        previous_phase = room.game_state.phase
        status = room.add_player(player_id, display_name)
        started_now = (
            previous_phase == GamePhase.WAITING_FOR_PLAYERS
            and room.game_state.phase == GamePhase.PLAYER_TURN
        )
        return status, room, started_now

    def _unique_code(self, length: int = 5) -> str:
        while True:
            code = "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))
            if code not in self.rooms:
                return code
