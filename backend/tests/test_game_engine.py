import pytest

from backend.game_engine import (
    Card,
    GamePhase,
    GameState,
    Player,
    TurnDirection,
    sort_cards,
)


def setup_two_player_state():
    state = GameState()
    state.add_player(Player(player_id="p1", display_name="P1"))
    state.add_player(Player(player_id="p2", display_name="P2"))
    state.start_game(["p1", "p2"], TurnDirection.CLOCKWISE)
    state.set_dealt_hands(
        {
            "p1": [Card(rank="A", suit="S", deck=1)],
            "p2": [Card(rank="K", suit="H", deck=1)],
        }
    )
    return state


def test_sort_cards_orders_by_rank_then_suit_then_deck():
    cards = [
        Card(rank="K", suit="S", deck=1),
        Card(rank="A", suit="C", deck=1),
        Card(rank="A", suit="C", deck=2),
        Card(rank="10", suit="H", deck=1),
    ]
    sorted_cards = sort_cards(cards)
    assert [card.code() for card in sorted_cards] == ["AC", "AC", "10H", "KS"]


def test_play_cards_updates_claim_and_pile():
    state = setup_two_player_state()
    state.play_cards("p1", [0], "A")
    assert state.last_claim is not None
    assert state.last_claim.rank == "A"
    assert len(state.pile) == 1
    assert state.phase == GamePhase.CLAIM_MADE
    assert state.current_player_id() == "p2"


def test_claim_rank_locked_for_round():
    state = setup_two_player_state()
    state.play_cards("p1", [0], "A")
    with pytest.raises(ValueError):
        state.play_cards("p2", [0], "K")


def test_pass_turn_discards_when_round_starter_passes():
    state = GameState()
    state.add_player(Player(player_id="p1", display_name="P1"))
    state.add_player(Player(player_id="p2", display_name="P2"))
    state.add_player(Player(player_id="p3", display_name="P3"))
    state.start_game(["p1", "p2", "p3"], TurnDirection.CLOCKWISE)
    state.set_dealt_hands(
        {
            "p1": [Card(rank="A", suit="S", deck=1)],
            "p2": [Card(rank="K", suit="H", deck=1)],
            "p3": [Card(rank="Q", suit="D", deck=1)],
        }
    )
    state.play_cards("p1", [0], "A")
    discarded = state.pass_turn("p2")
    assert discarded is False

    discarded = state.pass_turn("p3")
    assert discarded is False

    discarded = state.pass_turn("p1")
    assert discarded is True
    assert len(state.discard_pile) == 1
    assert state.phase == GamePhase.PLAYER_TURN


def test_call_bluff_penalizes_challenger_on_truthful_claim():
    state = setup_two_player_state()
    state.play_cards("p1", [0], "A")
    outcome = state.call_bluff("p2", 0)
    assert outcome.penalty_player_id == "p2"
    assert len(state.players["p2"].hand) == 2


def test_call_bluff_penalizes_claimant_on_false_claim():
    state = setup_two_player_state()
    state.players["p1"].hand = [Card(rank="K", suit="S", deck=1)]
    state.play_cards("p1", [0], "A")
    outcome = state.call_bluff("p2", 0)
    assert outcome.penalty_player_id == "p1"
    assert len(state.players["p1"].hand) == 1


def test_start_game_requires_two_players():
    state = GameState()
    state.add_player(Player(player_id="p1", display_name="P1"))
    with pytest.raises(ValueError):
        state.start_game(["p1"], TurnDirection.CLOCKWISE)
