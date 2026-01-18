from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

class GamePhase(str, Enum):
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS"
    DEALING = "DEALING"
    PLAYER_TURN = "PLAYER_TURN"
    CLAIM_MADE = "CLAIM_MADE"
    CHALLENGE = "CHALLENGE"
    RESOLUTION = "RESOLUTION"
    GAME_OVER = "GAME_OVER"

@dataclass
class Player:
    player_id: str
    display_name: str
    hand: List[int] = field(default_factory=list)


@dataclass
class Claim:
    player_id: str
    quantity: int
    face: int


@dataclass
class ChallengeOutcome:
    winner_id: str
    claim_truthful: bool
    matching_count: int


@dataclass
class GameState:
    phase: GamePhase = GamePhase.WAITING_FOR_PLAYERS
    players: Dict[str, Player] = field(default_factory=dict)
    turn_order: List[str] = field(default_factory=list)
    current_turn_index: int = 0
    last_claim: Optional[Claim] = None
    last_challenger_id: Optional[str] = None
    resolution_winner_id: Optional[str] = None
    last_claim_truthful: Optional[bool] = None
    last_matching_count: Optional[int] = None

    def _require_phase(self, *allowed: GamePhase) -> None:
        if self.phase not in allowed:
            allowed_names = ", ".join(p.value for p in allowed)
            raise ValueError(f"invalid phase {self.phase.value}; expected {allowed_names}")

    def add_player(self, player: Player) -> None:
        self._require_phase(GamePhase.WAITING_FOR_PLAYERS)
        if player.player_id in self.players:
            raise ValueError(f"player {player.player_id} already exists")
        self.players[player.player_id] = player

    def start_game(self, turn_order: List[str]) -> None:
        self._require_phase(GamePhase.WAITING_FOR_PLAYERS)
        if len(turn_order) < 2:
            raise ValueError("need at least two players to start")
        missing = [pid for pid in turn_order if pid not in self.players]
        if missing:
            raise ValueError(f"unknown players in turn order: {missing}")
        self.turn_order = list(turn_order)
        self.current_turn_index = 0
        self.phase = GamePhase.DEALING

    def set_dealt_hands(self, hands: Dict[str, List[int]]) -> None:
        self._require_phase(GamePhase.DEALING)
        for player_id in self.turn_order:
            if player_id not in hands:
                raise ValueError(f"missing hand for player {player_id}")
            self.players[player_id].hand = list(hands[player_id])
        self.phase = GamePhase.PLAYER_TURN

    def current_player_id(self) -> str:
        self._require_phase(GamePhase.PLAYER_TURN)
        return self.turn_order[self.current_turn_index]

    def current_actor_id(self) -> str:
        if self.phase == GamePhase.PLAYER_TURN:
            return self.turn_order[self.current_turn_index]
        if self.phase == GamePhase.CLAIM_MADE:
            return self.turn_order[self.current_turn_index]
        raise ValueError(f"no active actor in phase {self.phase.value}")

    def make_claim(self, player_id: str, quantity: int, face: int) -> None:
        self._require_phase(GamePhase.PLAYER_TURN)
        if player_id != self.current_player_id():
            raise ValueError("claim made out of turn")
        self._validate_claim_values(quantity, face)
        self.last_claim = Claim(player_id=player_id, quantity=quantity, face=face)
        self.last_challenger_id = None
        self.resolution_winner_id = None
        self.last_claim_truthful = None
        self.last_matching_count = None
        self.phase = GamePhase.CLAIM_MADE
        self._advance_turn()

    def raise_claim(self, player_id: str, quantity: int, face: int) -> None:
        self._require_phase(GamePhase.CLAIM_MADE)
        if self.last_claim is None:
            raise ValueError("no prior claim to raise")
        if player_id != self.current_actor_id():
            raise ValueError("raise made out of turn")
        self._validate_claim_values(quantity, face)
        if not self._is_higher_claim(quantity, face, self.last_claim):
            raise ValueError("raised claim must be higher than previous claim")
        self.last_claim = Claim(player_id=player_id, quantity=quantity, face=face)
        self.last_challenger_id = None
        self.resolution_winner_id = None
        self.last_claim_truthful = None
        self.last_matching_count = None
        self.phase = GamePhase.CLAIM_MADE
        self._advance_turn()

    def call_bluff(self, challenger_id: str) -> None:
        self._require_phase(GamePhase.CLAIM_MADE)
        if self.last_claim is None:
            raise ValueError("no claim to challenge")
        if challenger_id != self.current_actor_id():
            raise ValueError("challenge made out of turn")
        if challenger_id == self.last_claim.player_id:
            raise ValueError("claimer cannot challenge own claim")
        if challenger_id not in self.players:
            raise ValueError("unknown challenger")
        self.last_challenger_id = challenger_id
        self.phase = GamePhase.CHALLENGE

    def resolve_challenge(self) -> ChallengeOutcome:
        self._require_phase(GamePhase.CHALLENGE)
        if self.last_claim is None or self.last_challenger_id is None:
            raise ValueError("challenge missing claim or challenger")
        matching_count = self._count_face(self.last_claim.face)
        claim_truthful = matching_count >= self.last_claim.quantity
        if claim_truthful:
            winner_id = self.last_claim.player_id
        else:
            winner_id = self.last_challenger_id
        self.resolution_winner_id = winner_id
        self.last_claim_truthful = claim_truthful
        self.last_matching_count = matching_count
        self.phase = GamePhase.RESOLUTION
        return ChallengeOutcome(
            winner_id=winner_id,
            claim_truthful=claim_truthful,
            matching_count=matching_count,
        )

    def advance_after_resolution(self, game_over: bool = False) -> None:
        self._require_phase(GamePhase.RESOLUTION)
        if game_over:
            self.phase = GamePhase.GAME_OVER
            return
        self._advance_turn()
        self.phase = GamePhase.PLAYER_TURN
        self.last_claim = None
        self.last_challenger_id = None
        self.resolution_winner_id = None
        self.last_claim_truthful = None
        self.last_matching_count = None

    def _advance_turn(self) -> None:
        if not self.turn_order:
            raise ValueError("turn order not set")
        self.current_turn_index = (self.current_turn_index + 1) % len(self.turn_order)

    def _validate_claim_values(self, quantity: int, face: int) -> None:
        if quantity <= 0:
            raise ValueError("claim quantity must be positive")
        if face < 1 or face > 6:
            raise ValueError("claim face must be between 1 and 6")

    def _is_higher_claim(self, quantity: int, face: int, previous: Claim) -> bool:
        if quantity > previous.quantity:
            return True
        if quantity == previous.quantity and face > previous.face:
            return True
        return False

    def _count_face(self, face: int) -> int:
        total = 0
        for player in self.players.values():
            total += sum(1 for die in player.hand if die == face)
        return total
