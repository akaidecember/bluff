import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import PlayingCard from "../components/PlayingCard";
import { useSound } from "../lib/sound";
import type { ClientMessage, PrivateState, PublicState } from "../types/messages";

const CLAIM_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

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
  const activeRoundRank = publicState?.round_rank ?? null;

  const canPlay = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canPass = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canCallBluff =
    isMyTurn && phase === "CLAIM_MADE" && lastClaim !== null && lastClaim.player_id !== playerId;

  const effectiveClaimRank = activeRoundRank ?? claimRank;
  const pickMax = Math.max(publicState?.last_play_count ?? 1, 1);

  const playerNameById = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const player of publicState?.players ?? []) {
      mapping[player.player_id] = player.display_name;
    }
    return mapping;
  }, [publicState?.players]);

  useEffect(() => {
    if (activeRoundRank) {
      setClaimRank(activeRoundRank);
    }
  }, [activeRoundRank]);

  useEffect(() => {
    setSelectedIndices((previous) => previous.filter((index) => index < hand.length));
  }, [hand.length]);

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
      claim_rank: effectiveClaimRank,
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
    const name = playerNameById[lastClaim.player_id] ?? lastClaim.player_id;
    return `${name} claims ${lastClaim.count}x ${lastClaim.rank}.`;
  }, [lastClaim, playerNameById]);

  const starterName = useMemo(() => {
    if (!publicState?.round_starter_id) {
      return null;
    }
    return playerNameById[publicState.round_starter_id] ?? publicState.round_starter_id;
  }, [publicState?.round_starter_id, playerNameById]);

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
    const handKey = hand.join(",") || null;
    if (handKey && handKey !== lastHandRef.current) {
      play("reveal");
      lastHandRef.current = handKey;
    }
  }, [play, hand]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((previous) => {
      if (previous.includes(index)) {
        return previous.filter((value) => value !== index);
      }
      return [...previous, index];
    });
  };

  return (
    <main className="screen game-screen">
      <section className="panel status-panel">
        <h1>Room {roomCode}</h1>
        <div className="status-grid">
          <p>
            <span>Phase</span>
            <strong>{phase}</strong>
          </p>
          <p>
            <span>Decks</span>
            <strong>{publicState?.deck_count ?? 0}</strong>
          </p>
          <p>
            <span>Direction</span>
            <strong>{publicState?.direction ?? ""}</strong>
          </p>
          <p>
            <span>Pile</span>
            <strong>{publicState?.pile_count ?? 0} cards</strong>
          </p>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={publicState?.current_player_id ?? "none"}
            className="callout"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            Turn: {playerNameById[publicState?.current_player_id ?? ""] ?? publicState?.current_player_id ?? "TBD"}
          </motion.p>
        </AnimatePresence>
        <p className="callout">Last Claim: {claimHelper}</p>
        {activeRoundRank && starterName && (
          <p className="callout">Round Lock: {activeRoundRank} (started by {starterName})</p>
        )}
      </section>

      <section className="panel players-panel">
        <h2>Players</h2>
        <div className="player-list">
          {(publicState?.players ?? []).map((player) => {
            const finishedIndex = publicState?.finished_order.indexOf(player.player_id) ?? -1;
            const isCurrent = publicState?.current_player_id === player.player_id;
            return (
              <article
                key={player.player_id}
                className={`player-pill${isCurrent ? " current" : ""}${finishedIndex >= 0 ? " finished" : ""}`}
              >
                <h3>{player.display_name}</h3>
                <p>{player.hand_count} cards</p>
                {finishedIndex >= 0 && <p>Place #{finishedIndex + 1}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel hand-panel">
        <div className="panel-row">
          <h2>Your Hand</h2>
          <p>{hand.length} cards</p>
        </div>
        {hand.length === 0 ? (
          <p className="muted">No cards left.</p>
        ) : (
          <div className="hand-grid">
            {hand.map((card, index) => (
              <PlayingCard
                key={`${card}-${index}`}
                code={card}
                selected={selectedIndices.includes(index)}
                disabled={!canPlay}
                onClick={() => toggleSelect(index)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel actions-panel">
        <h2>Actions</h2>
        <div className="actions-grid">
          <div className="control-group">
            <label htmlFor="claim-rank">Claim Rank</label>
            <select
              id="claim-rank"
              value={effectiveClaimRank}
              onChange={(event) => setClaimRank(event.target.value)}
              disabled={Boolean(activeRoundRank)}
            >
              {CLAIM_RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
            {activeRoundRank && <small>Rank is locked for this round.</small>}
          </div>

          <div className="control-group">
            <label htmlFor="pick-index">Bluff Pick (1-{pickMax})</label>
            <input
              id="pick-index"
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
          </div>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="primary"
            onClick={playCards}
            disabled={!canPlay || selectedIndices.length === 0}
          >
            Play Selected ({selectedIndices.length})
          </button>
          <button type="button" className="secondary" onClick={passTurn} disabled={!canPass}>
            Pass
          </button>
          <button type="button" className="danger" onClick={callBluff} disabled={!canCallBluff}>
            Call Bluff
          </button>
        </div>
      </section>
    </main>
  );
}
