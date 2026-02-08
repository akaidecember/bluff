from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class GamePhase(str, Enum):
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS"
    DEALING = "DEALING"
    PLAYER_TURN = "PLAYER_TURN"
    CLAIM_MADE = "CLAIM_MADE"
    GAME_OVER = "GAME_OVER"


class TurnDirection(str, Enum):
    CLOCKWISE = "CLOCKWISE"
    COUNTERCLOCKWISE = "COUNTERCLOCKWISE"


RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["S", "H", "D", "C"]

JOKER_RANK = "JK"
JOKER_VARIANTS = ["R", "B"]

_SORT_RANKS = RANKS + [JOKER_RANK]
_RANK_ORDER = {rank: index for index, rank in enumerate(_SORT_RANKS)}
_SUIT_ORDER = {suit: index for index, suit in enumerate(["C", "D", "H", "S", "R", "B"])}

@dataclass(frozen=True)
class Card:
    rank: str
    suit: str
    deck: int

    def code(self) -> str:
        return f"{self.rank}{self.suit}"

@dataclass
class Player:
    player_id: str
    display_name: str
    hand: List[Card] = field(default_factory = list)

@dataclass
class Claim:
    player_id: str
    rank: str
    count: int

@dataclass
class ChallengeOutcome:
    claimant_id: str
    challenger_id: str
    penalty_player_id: str
    picked_card: Card
    picked_matches_claim: bool

@dataclass
class GameState:
    phase: GamePhase = GamePhase.WAITING_FOR_PLAYERS
    players: Dict[str, Player] = field(default_factory = dict)
    turn_order: List[str] = field(default_factory = list)
    current_turn_index: int = 0
    direction: TurnDirection = TurnDirection.CLOCKWISE
    last_claim: Optional[Claim] = None
    last_played_cards: List[Card] = field(default_factory = list)
    pile: List[Card] = field(default_factory = list)
    discard_pile: List[Card] = field(default_factory = list)
    finished_order: List[str] = field(default_factory = list)
    loser_id: Optional[str] = None
    round_rank: Optional[str] = None
    round_starter_id: Optional[str] = None

    def _require_phase(self, *allowed: GamePhase) -> None:
        if self.phase not in allowed:
            allowed_names = ", ".join(p.value for p in allowed)
            raise ValueError(f"invalid phase {self.phase.value}; expected {allowed_names}")

    def _direction_step(self) -> int:
        if self.direction == TurnDirection.CLOCKWISE:
            return 1
        else:
            return -1

    def add_player(self, player: Player) -> None:
        self._require_phase(GamePhase.WAITING_FOR_PLAYERS)

        if player.player_id in self.players:
            raise ValueError(f"player {player.player_id} already exists")
        
        self.players[player.player_id] = player

    def start_game(self, turn_order: List[str], direction: TurnDirection) -> None:
        self._require_phase(GamePhase.WAITING_FOR_PLAYERS)

        if len(turn_order) < 2:
            raise ValueError("need at least two players to start")
        
        missing = [pid for pid in turn_order if pid not in self.players]

        if missing:
            raise ValueError(f"unknown players in turn order: {missing}")
        
        self.turn_order = list(turn_order)
        self.current_turn_index = 0
        self.direction = direction
        self.phase = GamePhase.DEALING

    def set_dealt_hands(self, hands: Dict[str, List[Card]]) -> None:
        self._require_phase(GamePhase.DEALING)

        for player_id in self.turn_order:
            if player_id not in hands:
                raise ValueError(f"missing hand for player {player_id}")
            self.players[player_id].hand = sort_cards(hands[player_id])

        self.phase = GamePhase.PLAYER_TURN

    def current_player_id(self) -> str:
        if self.phase not in {GamePhase.PLAYER_TURN, GamePhase.CLAIM_MADE}:
            raise ValueError(f"no active player in phase {self.phase.value}")
        
        return self.turn_order[self.current_turn_index]

    def play_cards(self, player_id: str, card_indices: List[int], claim_rank: str) -> None:
        self._require_phase(GamePhase.PLAYER_TURN, GamePhase.CLAIM_MADE)

        if player_id != self.current_player_id():
            raise ValueError("play made out of turn")
        
        if claim_rank not in RANKS:
            raise ValueError("invalid claim rank")
        
        if not card_indices:
            raise ValueError("must play at least one card")

        hand = self.players[player_id].hand
        max_index = len(hand) - 1

        if any(index < 0 or index > max_index for index in card_indices):
            raise ValueError("card index out of range")
        
        if len(set(card_indices)) != len(card_indices):
            raise ValueError("duplicate card indices")

        # The first claim of a round locks the rank for everyone until reset.
        if self.last_claim is None:
            self.round_rank = claim_rank
            self.round_starter_id = player_id
        elif claim_rank != self.round_rank:
            raise ValueError(f"active round rank is {self.round_rank}; claim must match")

        played_cards: List[Card] = []

        for index in sorted(card_indices, reverse=True):
            played_cards.append(hand.pop(index))

        played_cards.reverse()

        self.last_played_cards = played_cards
        self.pile.extend(played_cards)
        self.last_claim = Claim(player_id=player_id, rank=claim_rank, count=len(played_cards))
        self.phase = GamePhase.CLAIM_MADE

        self._update_finished()
        self._advance_turn()

    def pass_turn(self, player_id: str) -> bool:
        self._require_phase(GamePhase.PLAYER_TURN, GamePhase.CLAIM_MADE)

        if player_id != self.current_player_id():
            raise ValueError("pass made out of turn")

        discarded = False

        if self.phase == GamePhase.CLAIM_MADE and self.round_starter_id == player_id:
            self._clear_round(discard=True)
            discarded = True

        self._update_finished()
        self._advance_turn()

        return discarded

    def call_bluff(self, challenger_id: str, pick_index: int) -> ChallengeOutcome:
        self._require_phase(GamePhase.CLAIM_MADE)

        if challenger_id != self.current_player_id():
            raise ValueError("challenge made out of turn")
        
        if self.last_claim is None:
            raise ValueError("no claim to challenge")
        
        if challenger_id == self.last_claim.player_id:
            raise ValueError("claimer cannot challenge own claim")
        
        if challenger_id not in self.players:
            raise ValueError("unknown challenger")
        
        if not self.last_played_cards:
            raise ValueError("no cards to challenge")
        
        if pick_index < 0 or pick_index >= len(self.last_played_cards):
            raise ValueError("picked card index out of range")

        picked_card = self.last_played_cards[pick_index]
        picked_matches = (picked_card.rank == self.last_claim.rank or picked_card.rank == JOKER_RANK)

        if picked_matches:
            penalty_player_id = challenger_id
        else:
            penalty_player_id = self.last_claim.player_id

        self.players[penalty_player_id].hand.extend(self.pile)
        self.players[penalty_player_id].hand = sort_cards(self.players[penalty_player_id].hand)

        outcome = ChallengeOutcome(
            claimant_id=self.last_claim.player_id,
            challenger_id=challenger_id,
            penalty_player_id=penalty_player_id,
            picked_card=picked_card,
            picked_matches_claim=picked_matches,
        )

        self._clear_round(discard=False)
        self._update_finished()
        self._advance_turn()

        return outcome

    def _clear_round(self, discard: bool) -> None:
        if discard and self.pile:
            self.discard_pile.extend(self.pile)

        self.pile = []
        self.last_claim = None
        self.last_played_cards = []
        self.round_rank = None
        self.round_starter_id = None
        self.phase = GamePhase.PLAYER_TURN

    def _advance_turn(self) -> None:
        if not self.turn_order:
            raise ValueError("turn order not set")
        
        if self.phase == GamePhase.GAME_OVER:
            return

        step = self._direction_step()

        for _ in range(len(self.turn_order)):
            self.current_turn_index = (self.current_turn_index + step) % len(self.turn_order)
            player_id = self.turn_order[self.current_turn_index]

            if player_id not in self.finished_order:
                return
            
        self.phase = GamePhase.GAME_OVER

    def _update_finished(self) -> None:
        for player_id in self.turn_order:
            if player_id in self.finished_order:
                continue

            if not self.players[player_id].hand:
                # A player that just claimed with an empty hand only ranks after
                # the claim cycle ends (bluff/discard).
                if self.last_claim and self.last_claim.player_id == player_id:
                    continue

                self.finished_order.append(player_id)

        if self.phase == GamePhase.CLAIM_MADE and self.last_claim is not None:
            claimant = self.last_claim.player_id

            if not self.players[claimant].hand:
                return
            
        remaining_with_cards = [
            player_id
            for player_id in self.turn_order
            if player_id not in self.finished_order and self.players[player_id].hand
        ]

        if len(remaining_with_cards) == 1:
            self.loser_id = remaining_with_cards[0]
            self.phase = GamePhase.GAME_OVER
        elif len(remaining_with_cards) == 0:
            self.loser_id = None
            self.phase = GamePhase.GAME_OVER

    def standings(self) -> List[str]:
        results = list(self.finished_order)

        if self.loser_id is not None:
            results.append(self.loser_id)

        return results


def sort_cards(cards: List[Card]) -> List[Card]:
    return sorted(cards,
        key=lambda card: (
            _RANK_ORDER.get(card.rank, len(_RANK_ORDER)),
            _SUIT_ORDER.get(card.suit, len(_SUIT_ORDER)),
            card.deck,
        ),
    )
