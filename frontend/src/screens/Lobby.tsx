import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";

import { cardSlideLeft, cardSlideRight } from "../lib/motion";
import type { ClientMessage, PublicState } from "../types/messages";

export type LobbyProps = {
  playerId: string;
  displayName: string;
  roomCode: string;
  deckCount: number;
  direction: string;
  publicState: PublicState | null;
  onChangePlayerId: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onChangeRoomCode: (value: string) => void;
  onChangeDeckCount: (value: number) => void;
  onChangeDirection: (value: string) => void;
  onSend: (message: ClientMessage) => void;
};

export default function Lobby({
  playerId,
  displayName,
  roomCode,
  deckCount,
  direction,
  publicState,
  onChangePlayerId,
  onChangeDisplayName,
  onChangeRoomCode,
  onChangeDeckCount,
  onChangeDirection,
  onSend,
}: LobbyProps) {
  const [showBurst, setShowBurst] = useState(false);
  const [copied, setCopied] = useState(false);
  const burstTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const createRoom = () => {
    onSend({
      type: "create_room",
      player_id: playerId,
      display_name: displayName,
      deck_count: deckCount,
      direction,
    });

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ffffff", "#ff4444", "#ffd700"],
    });

    setShowBurst(true);
    if (burstTimeoutRef.current) {
      window.clearTimeout(burstTimeoutRef.current);
    }
    burstTimeoutRef.current = window.setTimeout(() => {
      setShowBurst(false);
      burstTimeoutRef.current = null;
    }, 700);
  };

  const joinRoom = () => {
    onSend({
      type: "join_room",
      room_code: roomCode.toUpperCase(),
      player_id: playerId,
      display_name: displayName,
    });
  };

  const startGame = () => {
    onSend({ type: "start_game", room_code: roomCode.toUpperCase(), player_id: playerId });
  };

  const canStart =
    publicState &&
    publicState.phase === "WAITING_FOR_PLAYERS" &&
    publicState.host_id === playerId &&
    publicState.players.length >= 2;

  const isClockwise = direction === "CLOCKWISE";
  const roomCodeValue = publicState?.room_code ?? "";

  const handleCopyRoomCode = async () => {
    if (!roomCodeValue) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomCodeValue);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = roomCodeValue;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="screen lobby-screen">
      <section className="lobby-frame">
        <div className="hero">
          <h1>BLUFF</h1>
          <p>Can you get away with it?</p>
          <small>Host picks deck count and direction. Game supports 2 to 6 players.</small>
        </div>

        <div className="lobby-grid">
          <motion.div variants={cardSlideLeft} initial="hidden" animate="show">
            <section className="panel card-panel player-card-panel">
              <h2>Player Card</h2>
              <div className="field-grid">
                <label htmlFor="player-id">Player ID</label>
                <input
                id="player-id"
                value={playerId}
                onChange={(event) => onChangePlayerId(event.target.value)}
                placeholder="player-1"
              />
              <label htmlFor="display-name">Display Name</label>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => onChangeDisplayName(event.target.value)}
                placeholder="Your name"
                />
              </div>
            </section>
          </motion.div>

          <motion.div variants={cardSlideRight} initial="hidden" animate="show">
            <section className="panel card-panel room-settings-panel">
            <h2>Room Settings</h2>
            <div className="field-grid">
              <label htmlFor="room-code">Room Code</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => onChangeRoomCode(event.target.value)}
                placeholder="ABCDE"
              />

              <label htmlFor="deck-count">Decks</label>
              <select
                id="deck-count"
                value={deckCount}
                onChange={(event) => onChangeDeckCount(Number(event.target.value))}
              >
                <option value={1}>1 deck (54 cards incl. jokers)</option>
                <option value={2}>2 decks (108 cards incl. jokers)</option>
              </select>

              <label htmlFor="turn-direction">Direction</label>
              <button
                type="button"
                id="turn-direction"
                className="direction-toggle"
                onClick={() => onChangeDirection(isClockwise ? "COUNTERCLOCKWISE" : "CLOCKWISE")}
              >
                <motion.span
                  className="direction-icon"
                  animate={{ rotate: isClockwise ? 0 : 180 }}
                  transition={{ duration: 0.3 }}
                >
                  {isClockwise ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M7 6.5h6.2a4.8 4.8 0 1 1 0 9.6H9.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 6.5 4.5 4M7 6.5 4.5 9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M17 6.5H10.8a4.8 4.8 0 1 0 0 9.6H14.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M17 6.5 19.5 4M17 6.5 19.5 9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </motion.span>
                <motion.span
                  key={direction}
                  className="direction-label"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isClockwise ? "Clockwise" : "Counterclockwise"}
                </motion.span>
              </button>
            </div>

            <div className="button-row lobby-actions">
              <motion.button
                type="button"
                className="primary-btn"
                onClick={createRoom}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
              >
                Create Room
              </motion.button>
              <button type="button" className="secondary-btn" onClick={joinRoom}>
                Join Room
              </button>
            </div>

            {showBurst && (
              <motion.div
                className="card-burst"
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: -40, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                aria-hidden="true"
              >
                <span className="card-burst-card" />
              </motion.div>
            )}
            </section>
          </motion.div>
        </div>

        {publicState && (
          <div className="snapshot-container">
            <section className="panel card-panel snapshot-panel lobby-snapshot">
              <h2>Room Snapshot</h2>
              <div className="status-grid">
                <div className="snapshot-tile snapshot-room">
                  <span>Room</span>
                  <div className="snapshot-room-row">
                    <strong>{publicState.room_code}</strong>
                    <button type="button" className="copy-chip" onClick={handleCopyRoomCode}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <p className="snapshot-tile">
                  <span>Phase</span>
                  <strong>{publicState.phase}</strong>
                </p>
                <p className="snapshot-tile">
                  <span>Players</span>
                  <strong>{publicState.players.length}</strong>
                </p>
                <p className="snapshot-tile">
                  <span>Decks</span>
                  <strong>{publicState.deck_count}</strong>
                </p>
                <p className="snapshot-tile">
                  <span>Direction</span>
                  <strong>{publicState.direction}</strong>
                </p>
              </div>

              <div className="player-list compact">
                {publicState.players.map((player) => (
                  <article key={player.player_id} className="player-pill">
                    <h3>{player.display_name}</h3>
                    <p>{player.player_id}</p>
                  </article>
                ))}
              </div>

              {publicState.host_id === playerId && (
                <button type="button" className="primary" onClick={startGame} disabled={!canStart}>
                  Start Game
                </button>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
