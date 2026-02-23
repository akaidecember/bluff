export type PlayerSummary = {
  player_id: string;
  display_name: string;
  hand_count: number;
};

export type PublicState = {
  room_code: string;
  phase: string;
  host_id: string;
  deck_count: number;
  direction: string;
  players: PlayerSummary[];
  current_player_id: string | null;
  last_claim: {
    player_id: string;
    rank: string;
    count: number;
  } | null;
  round_rank: string | null;
  round_starter_id: string | null;
  last_play_count: number;
  pile_count: number;
  discard_pile_count: number;
  finished_order: string[];
  loser_id: string | null;
  standings: string[];
};

export type PrivateState = {
  room_code: string;
  player_id: string;
  hand: string[];
};

export type ServerMessage =
  | { type: "room_created"; room_code: string; player_id: string; phase: string }
  | { type: "room_joined"; room_code: string; player_id: string; phase: string }
  | { type: "room_already_joined"; room_code: string; player_id: string; phase: string }
  | { type: "room_not_found"; room_code: string }
  | { type: "room_full"; room_code: string }
  | { type: "room_closed"; room_code: string }
  | { type: "game_started"; room_code: string; phase: string }
  | { type: "public_state"; state: PublicState }
  | { type: "private_state"; state: PrivateState }
  | {
      type: "challenge_resolved";
      room_code: string;
      claimant_id: string;
      challenger_id: string;
      penalty_player_id: string;
      picked_card: string;
      picked_matches_claim: boolean;
    }
  | { type: "pile_discarded"; room_code: string; player_id: string }
  | { type: "invalid_action"; message: string }
  | { type: "error"; message: string };

export type ClientMessage =
  | {
      type: "create_room";
      player_id: string;
      display_name: string;
      deck_count: number;
      direction: string;
    }
  | {
      type: "join_room";
      room_code: string;
      player_id: string;
      display_name: string;
    }
  | { type: "start_game"; room_code: string; player_id: string }
  | { type: "sync_state"; room_code: string; player_id: string }
  | {
      type: "play_cards";
      room_code: string;
      player_id: string;
      card_indices: number[];
      claim_rank: string;
    }
  | { type: "pass_turn"; room_code: string; player_id: string }
  | { type: "call_bluff"; room_code: string; player_id: string; pick_index: number };
