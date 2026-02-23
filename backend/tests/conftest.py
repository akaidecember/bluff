import pytest

from backend import main
from backend.rooms import RoomManager


@pytest.fixture(autouse=True)
def reset_backend_state():
    main.manager = main.ConnectionManager()
    main.room_manager = RoomManager()
    main.room_connections = {}
    main.connection_rooms = {}
    main.connection_players = {}
    main.dev_autoplay_tasks = {}
    yield
