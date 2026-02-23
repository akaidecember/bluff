from fastapi.testclient import TestClient

from backend import main
from backend.game_engine import TurnDirection


def collect_messages(ws, count):
    messages = []
    for _ in range(count):
        messages.append(ws.receive_json())
    return messages


def test_health():
    client = TestClient(main.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_room_happy_path():
    client = TestClient(main.app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "create_room", "player_id": "p1", "display_name": "P1", "deck_count": 1, "direction": "CLOCKWISE"})
        first = ws.receive_json()
        assert first["type"] == "room_created"

        followups = collect_messages(ws, 2)
        types = {msg["type"] for msg in followups}
        assert "public_state" in types
        assert "private_state" in types


def test_create_room_invalid_direction():
    client = TestClient(main.app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "create_room", "player_id": "p1", "display_name": "P1", "direction": "BAD"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["message"] == "invalid direction"


def test_join_room_not_found():
    client = TestClient(main.app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "join_room", "room_code": "NOPE", "player_id": "p1", "display_name": "P1"})
        msg = ws.receive_json()
        assert msg["type"] == "room_not_found"


def test_start_game_non_host_rejected():
    client = TestClient(main.app)
    with client.websocket_connect("/ws") as host_ws:
        host_ws.send_json({"type": "create_room", "player_id": "host", "display_name": "Host", "deck_count": 1, "direction": "CLOCKWISE"})
        created = host_ws.receive_json()
        room_code = created["room_code"]
        _ = collect_messages(host_ws, 2)

        with client.websocket_connect("/ws") as guest_ws:
            guest_ws.send_json({"type": "join_room", "room_code": room_code, "player_id": "guest", "display_name": "Guest"})
            _ = guest_ws.receive_json()
            _ = collect_messages(guest_ws, 2)

            guest_ws.send_json({"type": "start_game", "room_code": room_code, "player_id": "guest"})
            msg = guest_ws.receive_json()
            assert msg["type"] == "invalid_action"


def test_player_id_mismatch_rejected():
    client = TestClient(main.app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "create_room", "player_id": "p1", "display_name": "P1", "deck_count": 1, "direction": TurnDirection.CLOCKWISE.value})
        created = ws.receive_json()
        room_code = created["room_code"]
        _ = collect_messages(ws, 2)

        ws.send_json({"type": "play_cards", "room_code": room_code, "player_id": "other", "card_indices": [0], "claim_rank": "A"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["message"] == "player_id mismatch"
