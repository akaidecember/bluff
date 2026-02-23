# API Documentation

Base backend URL (dev): `http://127.0.0.1:8000`

## HTTP Endpoints

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

## WebSocket Endpoint

### `GET ws://127.0.0.1:8000/ws`

Communication is JSON messages with a top-level `type`.

## Client -> Server Messages

### `create_room`

```json
{
  "type": "create_room",
  "player_id": "player-1",
  "display_name": "Player One",
  "deck_count": 1,
  "direction": "CLOCKWISE"
}
```

Rules:

- `deck_count` must be `1` or `2`
- `direction` in `CLOCKWISE|COUNTERCLOCKWISE`

### `join_room`

```json
{
  "type": "join_room",
  "room_code": "ABCDE",
  "player_id": "player-2",
  "display_name": "Player Two"
}
```

### `start_game`

```json
{
  "type": "start_game",
  "room_code": "ABCDE",
  "player_id": "player-1"
}
```

Rules:

- Only host can start.
- Room must have at least 2 players.

### `play_cards`

```json
{
  "type": "play_cards",
  "room_code": "ABCDE",
  "player_id": "player-1",
  "card_indices": [0, 3, 5],
  "claim_rank": "A"
}
```

Rules:

- Must be active player's turn.
- `card_indices` must be unique and in range.
- `claim_rank` must match locked round rank after round starts.

### `pass_turn`

```json
{
  "type": "pass_turn",
  "room_code": "ABCDE",
  "player_id": "player-1"
}
```

### `call_bluff`

```json
{
  "type": "call_bluff",
  "room_code": "ABCDE",
  "player_id": "player-2",
  "pick_index": 1
}
```

Rules:

- Must be active challenger turn.
- Available only in `CLAIM_MADE`.
- Challenger cannot be claimant.

## Server -> Client Messages

### Room lifecycle

- `room_created`
- `room_joined`
- `room_already_joined`
- `room_not_found`
- `room_full`
- `room_closed`
- `game_started`

### State sync

- `public_state`
- `private_state`

### Game events

- `challenge_resolved`
- `pile_discarded`

### Errors

- `invalid_action`
- `error`

## Message Schemas

### `public_state`

```json
{
  "type": "public_state",
  "state": {
    "room_code": "ABCDE",
    "phase": "PLAYER_TURN",
    "host_id": "player-1",
    "deck_count": 1,
    "direction": "CLOCKWISE",
    "players": [
      {
        "player_id": "player-1",
        "display_name": "Player One",
        "hand_count": 13
      }
    ],
    "current_player_id": "player-1",
    "last_claim": {
      "player_id": "player-2",
      "rank": "A",
      "count": 2
    },
    "round_rank": "A",
    "round_starter_id": "player-2",
    "last_play_count": 2,
    "pile_count": 8,
    "discard_pile_count": 20,
    "finished_order": ["player-3"],
    "loser_id": null,
    "standings": ["player-3"]
  }
}
```

### `private_state`

```json
{
  "type": "private_state",
  "state": {
    "room_code": "ABCDE",
    "player_id": "player-1",
    "hand": ["AS", "10D", "JKR"]
  }
}
```

### `challenge_resolved`

```json
{
  "type": "challenge_resolved",
  "room_code": "ABCDE",
  "claimant_id": "player-1",
  "challenger_id": "player-2",
  "penalty_player_id": "player-1",
  "picked_card": "6H",
  "picked_matches_claim": false
}
```

## Error Handling

Typical error payload:

```json
{
  "type": "invalid_action",
  "message": "play made out of turn"
}
```

or

```json
{
  "type": "error",
  "message": "unknown message type"
}
```

## Dev Mode (Hidden)

When `BLUFFER_DEV_MODE=1` is set on the backend, dev-only WebSocket commands are enabled.
They are ignored with an error when dev mode is off.

### `dev_seed_room`

Creates a room and auto-adds bot players (2 to 6 total).

```json
{
  "type": "dev_seed_room",
  "player_id": "dev-host",
  "display_name": "Dev Host",
  "player_count": 4,
  "deck_count": 1,
  "direction": "CLOCKWISE"
}
```

Response uses the normal `room_created` payload and state sync messages, with an extra `dev_mode: true` field.

### `dev_autoplay`

Auto-runs the game to completion (or until `max_steps`) using a simple bot policy.

```json
{
  "type": "dev_autoplay",
  "room_code": "ABCDE",
  "delay_ms": 50,
  "max_steps": 5000,
  "seed": 123
}
```

Emits `dev_autoplay_started` and `dev_autoplay_done` messages plus the usual
`public_state`/`private_state` updates and game events.

## Connection Model

- No authentication currently.
- Client identity relies on provided `player_id`.
- Backend validates `player_id` ownership per socket for gameplay actions.
