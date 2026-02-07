import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSound } from "../lib/sound";
import type { ClientMessage, PrivateState, PublicState } from "../types/messages";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export type GameProps = {
  playerId: string;
  roomCode: string;
  publicState: PublicState | null;
  privateState: PrivateState | null;
  onSend: (message: ClientMessage) => void;
};

export default function Game({
  playerId,
  roomCode,
  publicState,
  privateState,
  onSend,
}: GameProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [claimRank, setClaimRank] = useState("A");
  const [pickIndex, setPickIndex] = useState(0);
  const { play } = useSound();

  const phase = publicState?.phase ?? "UNKNOWN";
  const isMyTurn = publicState?.current_player_id === playerId;
  const lastClaim = publicState?.last_claim ?? null;
  const hand = privateState?.hand ?? [];

  const canPlay = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canPass = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canCallBluff =
    isMyTurn &&
    phase === "CLAIM_MADE" &&
    lastClaim !== null &&
    lastClaim.player_id !== playerId;

  const playCards = () => {
    const card_indices = [...selectedIndices].sort((a, b) => a - b);
    if (card_indices.length === 0) {
      return;
    }
    onSend({
      type: "play_cards",
      room_code: roomCode,
      player_id: playerId,
      card_indices,
      claim_rank: claimRank,
    });
    setSelectedIndices([]);
  };

  const passTurn = () => {
    onSend({ type: "pass_turn", room_code: roomCode, player_id: playerId });
  };

  const callBluff = () => {
    onSend({
      type: "call_bluff",
      room_code: roomCode,
      player_id: playerId,
      pick_index: pickIndex,
    });
  };

  const claimHelper = useMemo(() => {
    if (!lastClaim) {
      return "No claim yet.";
    }
    return `${lastClaim.player_id} claims ${lastClaim.count}x ${lastClaim.rank}.`;
  }, [lastClaim]);

  const lastTurnRef = useRef<string | null>(null);
  const lastClaimRef = useRef<string | null>(null);
  const lastHandRef = useRef<string | null>(null);

  useEffect(() => {
    const currentTurn = publicState?.current_player_id ?? null;
    if (currentTurn && currentTurn !== lastTurnRef.current) {
      play("turn");
      lastTurnRef.current = currentTurn;
    }
  }, [play, publicState?.current_player_id]);

  useEffect(() => {
    const claimKey = lastClaim ? `${lastClaim.player_id}-${lastClaim.count}-${lastClaim.rank}` : null;
    if (claimKey && claimKey !== lastClaimRef.current) {
      play("claim");
      lastClaimRef.current = claimKey;
    }
  }, [play, lastClaim]);

  useEffect(() => {
    const handKey = hand.join(",") ?? null;
    if (handKey && handKey !== lastHandRef.current) {
      play("reveal");
      lastHandRef.current = handKey;
    }
  }, [play, hand]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((value) => value !== index);
      }
      return [...prev, index];
    });
  };

  const pickMax = lastClaim ? Math.max(lastClaim.count, 1) : 1;

  return (
    <main>
      <h1>Game Room {roomCode}</h1>
      <section>
        <h2>Status</h2>
        <p>Phase: {phase}</p>
        <p>Decks: {publicState?.deck_count ?? 0}</p>
        <p>Direction: {publicState?.direction ?? ""}</p>
        <p>Pile: {publicState?.pile_count ?? 0} cards</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={publicState?.current_player_id ?? "none"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            Current Turn: {publicState?.current_player_id ?? "TBD"}
          </motion.p>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={lastClaim ? `${lastClaim.player_id}-${lastClaim.count}-${lastClaim.rank}` : "no-claim"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            Last Claim: {claimHelper}
          </motion.p>
        </AnimatePresence>
      </section>

      {publicState && (
        <section>
          <h2>Players</h2>
          <ul>
            {publicState.players.map((player) => (
              <li key={player.player_id}>
                {player.display_name} ({player.player_id}) - {player.hand_count} cards
              </li>
            ))}
          </ul>
          {publicState.finished_order.length > 0 && (
            <p>Finished: {publicState.finished_order.join(", ")}</p>
          )}
        </section>
      )}

      <section>
        <h2>Your Hand</h2>
        <div>
          {hand.length === 0 ? (
            <p>No cards.</p>
          ) : (
            hand.map((card, index) => (
              <button
                type="button"
                key={`${card}-${index}`}
                onClick={() => toggleSelect(index)}
                disabled={!canPlay}
                style={{
                  marginRight: "0.5rem",
                  marginBottom: "0.5rem",
                  fontWeight: selectedIndices.includes(index) ? "bold" : "normal",
                }}
              >
                {card}
              </button>
            ))
          )}
        </div>
      </section>

      <section>
        <h2>Actions</h2>
        <fieldset>
          <legend>Play Cards</legend>
          <p>Selected: {selectedIndices.length} card(s)</p>
          <label>
            Claim Rank
            <select value={claimRank} onChange={(event) => setClaimRank(event.target.value)}>
              {RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <button type="button" onClick={playCards} disabled={!canPlay || selectedIndices.length === 0}>
          Play Selected
        </button>
        <button type="button" onClick={passTurn} disabled={!canPass}>
          Pass
        </button>
        <fieldset>
          <legend>Call Bluff</legend>
          <label>
            Pick a card (1-{pickMax})
            <input
              type="number"
              min={1}
              max={pickMax}
              value={Math.min(pickIndex + 1, pickMax)}
              onChange={(event) => {
                const rawValue = Number(event.target.value);
                if (Number.isNaN(rawValue)) {
                  setPickIndex(0);
                  return;
                }
                const clamped = Math.max(1, Math.min(pickMax, rawValue));
                setPickIndex(clamped - 1);
              }}
            />
          </label>
        </fieldset>
        <button type="button" onClick={callBluff} disabled={!canCallBluff}>
          Call Bluff
        </button>
      </section>
    </main>
  );
}
