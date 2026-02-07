from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import random
import secrets
import string
from typing import Dict, List, Optional, Tuple

from .game_engine import Card, GamePhase, GameState, Player, RANKS, SUITS, TurnDirection


ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits
MIN_PLAYERS = 2
MAX_PLAYERS = 6
VALID_DECK_COUNTS = {1, 2}


class JoinStatus(str, Enum):
    JOINED = "JOINED"
    ALREADY_JOINED = "ALREADY_JOINED"
    FULL = "FULL"
    NOT_FOUND = "NOT_FOUND"
    CLOSED = "CLOSED"


def build_deck(deck_count: int) -> List[Card]:
    if deck_count not in VALID_DECK_COUNTS:
        raise ValueError("deck count must be 1 or 2")
    deck: List[Card] = []
    for deck_id in range(1, deck_count + 1):
        for suit in SUITS:
            for rank in RANKS:
                deck.append(Card(rank=rank, suit=suit, deck=deck_id))
    random.SystemRandom().shuffle(deck)
    return deck


@dataclass
class Room:
    code: str
    host_id: str
    deck_count: int
    direction: TurnDirection
    max_players: int = MAX_PLAYERS
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
        return JoinStatus.JOINED

    def can_start(self) -> bool:
        return len(self.players) >= MIN_PLAYERS

    def start_game(self) -> None:
        if not self.can_start():
            raise ValueError("need at least two players to start")
        total_cards = 52 * self.deck_count
        if total_cards % len(self.players) != 0:
            raise ValueError("player count must evenly divide the deck")
        deck = build_deck(self.deck_count)
        cards_per_player = total_cards // len(self.players)
        hands: Dict[str, List[Card]] = {}
        for index, player_id in enumerate(self.join_order):
            start = index * cards_per_player
            end = start + cards_per_player
            hands[player_id] = deck[start:end]
        self.game_state.start_game(self.join_order, self.direction)
        self.game_state.set_dealt_hands(hands)


@dataclass
class RoomManager:
    rooms: Dict[str, Room] = field(default_factory=dict)

    def create_room(
        self, player_id: str, display_name: str, deck_count: int, direction: TurnDirection
    ) -> Room:
        code = self._unique_code()
        if deck_count not in VALID_DECK_COUNTS:
            raise ValueError("deck count must be 1 or 2")
        room = Room(code=code, host_id=player_id, deck_count=deck_count, direction=direction)
        room.add_player(player_id, display_name)
        self.rooms[code] = room
        return room

    def join_room(
        self, room_code: str, player_id: str, display_name: str
    ) -> Tuple[JoinStatus, Optional[Room]]:
        room = self.rooms.get(room_code)
        if room is None:
            return JoinStatus.NOT_FOUND, None
        status = room.add_player(player_id, display_name)
        return status, room

    def start_game(self, room_code: str, player_id: str) -> Room:
        room = self.rooms.get(room_code)
        if room is None:
            raise ValueError("room not found")
        if room.host_id != player_id:
            raise ValueError("only host can start the game")
        if room.game_state.phase != GamePhase.WAITING_FOR_PLAYERS:
            raise ValueError("game already started")
        room.start_game()
        return room

    def _unique_code(self, length: int = 5) -> str:
        while True:
            code = "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))
            if code not in self.rooms:
                return code
