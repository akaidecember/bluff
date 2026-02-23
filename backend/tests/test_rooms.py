import pytest

from backend.rooms import JoinStatus, Room, RoomManager, build_deck
from backend.game_engine import TurnDirection, GamePhase


def test_build_deck_counts_and_jokers():
    deck = build_deck(1)
    assert len(deck) == 54
    assert sum(1 for card in deck if card.rank == "JK") == 2

    deck_two = build_deck(2)
    assert len(deck_two) == 108
    assert sum(1 for card in deck_two if card.rank == "JK") == 4


def test_build_deck_invalid_count():
    with pytest.raises(ValueError):
        build_deck(3)


def test_room_add_player_states():
    room = Room(code="ABCDE", host_id="host", deck_count=1, direction=TurnDirection.CLOCKWISE)
    assert room.add_player("host", "Host") == JoinStatus.JOINED
    assert room.add_player("host", "Host") == JoinStatus.ALREADY_JOINED

    for idx in range(1, room.max_players):
        status = room.add_player(f"p{idx}", f"Player {idx}")
        if idx < room.max_players:
            assert status in {JoinStatus.JOINED, JoinStatus.FULL}

    assert room.is_full()
    assert room.add_player("extra", "Extra") == JoinStatus.FULL

    room.game_state.phase = GamePhase.WAITING_FOR_PLAYERS
    if room.can_start():
        room.start_game()
    assert room.add_player("late", "Late") == JoinStatus.FULL


def test_room_manager_start_game_host_only():
    manager = RoomManager()
    room = manager.create_room("host", "Host", 1, TurnDirection.CLOCKWISE)
    manager.join_room(room.code, "p2", "P2")

    with pytest.raises(ValueError):
        manager.start_game(room.code, "p2")

    started = manager.start_game(room.code, "host")
    assert started.game_state.phase == GamePhase.PLAYER_TURN


def test_room_manager_join_room_not_found():
    manager = RoomManager()
    status, room = manager.join_room("NOPE", "p1", "Player")
    assert status == JoinStatus.NOT_FOUND
    assert room is None
