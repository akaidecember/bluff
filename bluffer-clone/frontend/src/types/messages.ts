export type PlayerSummary = {
  player_id: string;
  display_name: string;
};

export type PublicState = {
  room_code: string;
  phase: string;
  players: PlayerSummary[];
  current_player_id: string | null;
  last_claim: {
    player_id: string;
    quantity: number;
    face: number;
  } | null;
  last_challenger_id: string | null;
  resolution_winner_id: string | null;
};

export type PrivateState = {
  room_code: string;
  player_id: string;
  hand: number[];
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
      winner_id: string;
      claim_truthful: boolean;
      matching_count: number;
      claim: { player_id: string; quantity: number; face: number };
    }
  | { type: "invalid_action"; message: string }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "create_room"; player_id: string; display_name: string }
  | {
      type: "join_room";
      room_code: string;
      player_id: string;
      display_name: string;
    }
  | {
      type: "make_claim";
      room_code: string;
      player_id: string;
      quantity: number;
      face: number;
    }
  | {
      type: "raise_claim";
      room_code: string;
      player_id: string;
      quantity: number;
      face: number;
    }
  | { type: "call_bluff"; room_code: string; player_id: string };
