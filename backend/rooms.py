"""Room and lobby management for the Bluff game server."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import random
import secrets
import string
from typing import Dict, List, Optional, Tuple

try:
    from .game_engine import (
        Card,
        GamePhase,
        GameState,
        JOKER_RANK,
        JOKER_VARIANTS,
        Player,
        RANKS,
        SUITS,
        TurnDirection,
    )
except ImportError:  # pragma: no cover - fallback for non-package execution
    from game_engine import (
        Card,
        GamePhase,
        GameState,
        JOKER_RANK,
        JOKER_VARIANTS,
        Player,
        RANKS,
        SUITS,
        TurnDirection,
    )


ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits
MIN_PLAYERS = 2
MAX_PLAYERS = 6
VALID_DECK_COUNTS = {1, 2}

class JoinStatus(str, Enum):
    """Result of attempting to join a room."""

    JOINED = "JOINED"
    ALREADY_JOINED = "ALREADY_JOINED"
    FULL = "FULL"
    NOT_FOUND = "NOT_FOUND"
    CLOSED = "CLOSED"

def build_deck(deck_count: int) -> List[Card]:
    """Build and shuffle a deck (or double deck) of cards with jokers.

    Args:
        deck_count: Number of decks to include (1 or 2).

    Returns:
        Shuffled list of Card instances.

    Raises:
        ValueError: If deck_count is not 1 or 2.
    """
    if deck_count not in VALID_DECK_COUNTS:
        raise ValueError("deck count must be 1 or 2")
    
    deck: List[Card] = []

    for deck_id in range(1, deck_count + 1):
        for suit in SUITS:
            for rank in RANKS:
                deck.append(Card(rank=rank, suit=suit, deck=deck_id))

        for joker_variant in JOKER_VARIANTS:
            deck.append(Card(rank=JOKER_RANK, suit=joker_variant, deck=deck_id))
            
    random.SystemRandom().shuffle(deck)
    return deck

@dataclass
class Room:
    """Room state for a single game lobby and its current game."""

    code: str
    host_id: str
    deck_count: int
    direction: TurnDirection
    max_players: int = MAX_PLAYERS
    players: Dict[str, Player] = field(default_factory=dict)
    join_order: List[str] = field(default_factory=list)
    game_state: GameState = field(default_factory=GameState)

    def is_full(self) -> bool:
        """Return True if the room has reached its player capacity.

        Args:
            None.

        Returns:
            True if player count >= max_players.

        Raises:
            None.
        """
        return len(self.players) >= self.max_players

    def add_player(self, player_id: str, display_name: str) -> JoinStatus:
        """Add a player to the room, returning a JoinStatus outcome.

        Args:
            player_id: Stable player identifier.
            display_name: Human-readable name for the player.

        Returns:
            JoinStatus indicating the outcome.

        Raises:
            None.
        """
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
        """Return True if the room has the minimum players to start.

        Args:
            None.

        Returns:
            True if the room meets the MIN_PLAYERS requirement.

        Raises:
            None.
        """
        return len(self.players) >= MIN_PLAYERS

    def start_game(self) -> None:
        """Deal cards and transition the room into an active game.

        Args:
            None.

        Returns:
            None.

        Raises:
            ValueError: If there are not enough players to start.
        """
        if not self.can_start():
            raise ValueError("need at least two players to start")
        
        deck = build_deck(self.deck_count)
        hands: Dict[str, List[Card]] = {player_id: [] for player_id in self.join_order}

        for card_index, card in enumerate(deck):
            player_id = self.join_order[card_index % len(self.join_order)]
            hands[player_id].append(card)
            
        self.game_state.start_game(self.join_order, self.direction)
        self.game_state.set_dealt_hands(hands)

@dataclass
class RoomManager:
    """In-memory registry of rooms and room lifecycle helpers."""

    rooms: Dict[str, Room] = field(default_factory=dict)

    def create_room(self, player_id: str, display_name: str, deck_count: int, direction: TurnDirection) -> Room:
        """Create a room, register it, and join the host player.

        Args:
            player_id: Host player identifier.
            display_name: Host display name.
            deck_count: Number of decks to include (1 or 2).
            direction: Initial turn direction.

        Returns:
            The created Room instance.

        Raises:
            ValueError: If deck_count is not 1 or 2.
        """
        code = self._unique_code()

        if deck_count not in VALID_DECK_COUNTS:
            raise ValueError("deck count must be 1 or 2")
        
        room = Room(code=code, host_id=player_id, deck_count=deck_count, direction=direction)
        room.add_player(player_id, display_name)
        self.rooms[code] = room

        return room

    def join_room(self, room_code: str, player_id: str, display_name: str) -> Tuple[JoinStatus, Optional[Room]]:
        """Join an existing room by code, returning status and room.

        Args:
            room_code: Room code to look up.
            player_id: Joining player identifier.
            display_name: Joining player display name.

        Returns:
            Tuple of (JoinStatus, Room or None).

        Raises:
            None.
        """
        room = self.rooms.get(room_code)

        if room is None:
            return JoinStatus.NOT_FOUND, None
        
        status = room.add_player(player_id, display_name)

        return status, room

    def start_game(self, room_code: str, player_id: str) -> Room:
        """Start the game for a room, enforcing host-only permissions.

        Args:
            room_code: Room code to start.
            player_id: Requesting player identifier.

        Returns:
            The Room whose game has started.

        Raises:
            ValueError: If the room is missing, already started, or the caller is not the host.
        """
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
        """Generate a unique room code not currently in use.

        Args:
            length: Number of characters in the room code.

        Returns:
            Unique room code string.

        Raises:
            None.
        """
        while True:
            code = "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))

            if code not in self.rooms:
                return code
