from __future__ import annotations

import argparse
import random
from typing import Optional

from .dev_tools import apply_dev_action, choose_dev_action, seed_room_for_dev
from .game_engine import GamePhase, TurnDirection
from .rooms import MAX_PLAYERS, MIN_PLAYERS, RoomManager


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run dev autoplayer simulations.")
    parser.add_argument(
        "--players",
        type=int,
        default=MIN_PLAYERS,
        help=f"player count ({MIN_PLAYERS}-{MAX_PLAYERS})",
    )
    parser.add_argument(
        "--games",
        type=int,
        default=1,
        help="number of games to simulate",
    )
    parser.add_argument(
        "--deck-count",
        type=int,
        default=1,
        choices=[1, 2],
        help="number of decks",
    )
    parser.add_argument(
        "--direction",
        type=str,
        default=TurnDirection.CLOCKWISE.value,
        choices=[value.value for value in TurnDirection],
        help="turn direction",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=5000,
        help="max actions before aborting a game",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="random seed (omit for random)",
    )
    parser.add_argument(
        "--log-steps",
        action="store_true",
        help="log each action",
    )
    return parser.parse_args()


def _run_single_game(
    player_count: int,
    deck_count: int,
    direction: TurnDirection,
    max_steps: int,
    seed: Optional[int],
    log_steps: bool,
) -> tuple[int, list[str], Optional[str]]:
    rng = random.Random(seed)
    room_manager = RoomManager()
    room = seed_room_for_dev(
        room_manager,
        host_id="dev-host",
        host_name="Dev Host",
        deck_count=deck_count,
        direction=direction,
        player_count=player_count,
    )

    room.start_game()

    steps = 0
    while room.game_state.phase != GamePhase.GAME_OVER and steps < max_steps:
        action = choose_dev_action(room, rng)
        apply_dev_action(room, action)
        steps += 1
        if log_steps:
            print(
                f"step={steps} phase={room.game_state.phase.value} "
                f"player={action.player_id} action={action.kind}"
            )

    return steps, room.game_state.standings(), room.game_state.loser_id


def main() -> None:
    args = _parse_args()
    direction = TurnDirection(args.direction)
    base_seed = args.seed

    for game_index in range(1, args.games + 1):
        seed = None if base_seed is None else base_seed + game_index - 1
        steps, standings, loser_id = _run_single_game(
            player_count=args.players,
            deck_count=args.deck_count,
            direction=direction,
            max_steps=args.max_steps,
            seed=seed,
            log_steps=args.log_steps,
        )
        print(
            f"game={game_index} steps={steps} standings={standings} loser={loser_id}"
        )


if __name__ == "__main__":
    main()
