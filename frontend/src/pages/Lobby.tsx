import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";

import { GameSetupChips } from "../components/GameSetupChips";
import { PlayerPills } from "../components/PlayerPills";
import { RoomCodeCard } from "../components/RoomCodeCard";
import { Toasts, type Toast } from "../components/Toasts";
import { cardSlideLeft, cardSlideRight } from "../lib/motion";
import type { ClientMessage, PublicState } from "../types/messages";
import "../styles/lobby.css";

const ROOM_CODE_LENGTH = 5;
const MAX_ROOM_CODE_LENGTH = 6;

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

function sanitizeRoomCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").slice(0, MAX_ROOM_CODE_LENGTH);
}

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutsRef = useRef(new Map<string, number>());
  const seenPlayersRef = useRef(new Set<string>());
  const initializedPlayersRef = useRef(false);

  const players = publicState?.players ?? [];
  const isHost = publicState?.host_id === playerId;
  const activeRoomCode = (publicState?.room_code ?? roomCode).toUpperCase();
  const activeDeckCount = publicState?.deck_count ?? deckCount;
  const deckLabel = activeDeckCount === 1 ? "1 deck (54 cards)" : "2 decks (108 cards)";
  const directionLabel = (publicState?.direction ?? direction) === "CLOCKWISE" ? "Playing clockwise" : "Playing counterclockwise";
  const isRoomCodeValid = roomCode.trim().length === ROOM_CODE_LENGTH;

  const statusText = useMemo(() => {
    if (!publicState) {
      return "Create a room or join with a code to get started.";
    }
    if (players.length < 2) {
      return "Waiting for players...";
    }
    if (players.length < 6) {
      return `Ready when you are - invite ${6 - players.length} more if you want.`;
    }
    return "Full room - let's go!";
  }, [players.length, publicState]);

  const pushToast = useCallback((text: string) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 2500);
    toastTimeoutsRef.current.set(id, timeoutId);
  }, []);

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && roomCode.trim().length === 0) {
      onChangeRoomCode(sanitizeRoomCode(codeParam));
    }
  }, [searchParams, roomCode, onChangeRoomCode]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!publicState) {
      return;
    }
    const currentIds = new Set(players.map((player) => player.player_id));
    if (!initializedPlayersRef.current) {
      seenPlayersRef.current = currentIds;
      initializedPlayersRef.current = true;
      return;
    }

    const newPlayers = players.filter((player) => !seenPlayersRef.current.has(player.player_id));
    if (newPlayers.length > 0) {
      newPlayers.forEach((player) => {
        pushToast(`${player.display_name} joined the room`);
      });
      confetti({ particleCount: 18, spread: 40, origin: { y: 0.2 } });
    }
    seenPlayersRef.current = currentIds;
  }, [players, publicState, pushToast]);

  const handleCreateRoom = () => {
    onSend({
      type: "create_room",
      player_id: playerId.trim(),
      display_name: displayName.trim(),
      deck_count: deckCount,
      direction,
    });
  };

  const handleJoinRoom = () => {
    if (!isRoomCodeValid) {
      return;
    }
    onSend({
      type: "join_room",
      room_code: roomCode.trim().toUpperCase(),
      player_id: playerId.trim(),
      display_name: displayName.trim(),
    });
  };

  const handleStartGame = () => {
    if (!publicState) {
      return;
    }
    confetti({ particleCount: 70, spread: 55, origin: { y: 0.7 } });
    onSend({ type: "start_game", room_code: publicState.room_code, player_id: playerId.trim() });
  };

  const handleCopyCode = async () => {
    if (!activeRoomCode) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeRoomCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = activeRoomCode;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      pushToast("Code copied!");
    } catch {
      pushToast("Copy failed. Try again.");
    }
  };

  const handleRoomCodeChange = (value: string) => {
    onChangeRoomCode(sanitizeRoomCode(value));
  };

  return (
    <motion.div
      className="lobby-page"
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25 }}
    >
      <div className="felt-bg" aria-hidden="true" />
      <Toasts toasts={toasts} />

      <motion.div className="lobby-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="lobby-hero">
          <h1
            className="lobby-brand"
            onClick={() => navigate("/")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate("/");
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Back to home"
          >
            BLUFF
          </h1>
          <p>Can you get away with it?</p>
        </div>

        <div className="lobby-grid">
          <motion.div className="left" variants={cardSlideLeft} initial="hidden" animate="show">
            <RoomCodeCard code={activeRoomCode} onCopyCode={handleCopyCode} />
            <div className="status-line">{statusText}</div>
            <PlayerPills
              players={players.map((player) => ({
                id: player.player_id,
                name: player.display_name,
                isHost: publicState?.host_id === player.player_id,
              }))}
            />
            {publicState && players.length <= 1 && (
              <div className="empty-state">Invite friends with the link above.</div>
            )}
            <GameSetupChips decksLabel={deckLabel} directionLabel={directionLabel} />
          </motion.div>

          <motion.div className="right card" variants={cardSlideRight} initial="hidden" animate="show">
            <h2>Your profile</h2>
            <div className="field-grid slim">
              <label htmlFor="player-id">Player tag</label>
              <input
                id="player-id"
                value={playerId}
                onChange={(event) => onChangePlayerId(event.target.value)}
                placeholder="player-1"
                aria-label="Player tag"
              />
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => onChangeDisplayName(event.target.value)}
                placeholder="Your name"
                aria-label="Display name"
              />
              <label htmlFor="room-code">Invite code</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => handleRoomCodeChange(event.target.value)}
                placeholder="ABCDE"
                aria-label="Invite code"
                maxLength={MAX_ROOM_CODE_LENGTH}
              />
              <label htmlFor="deck-count">Card stacks</label>
              <select
                id="deck-count"
                value={deckCount}
                onChange={(event) => onChangeDeckCount(Number(event.target.value))}
                aria-label="Card stacks"
              >
                <option value={1}>1 deck (54 cards incl. jokers)</option>
                <option value={2}>2 decks (108 cards incl. jokers)</option>
              </select>
              <label htmlFor="turn-order">Turn order</label>
              <div className="turn-order">
                <motion.button
                  type="button"
                  id="turn-order"
                  className="direction-toggle"
                  onClick={() => onChangeDirection(direction === "CLOCKWISE" ? "COUNTERCLOCKWISE" : "CLOCKWISE")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Turn order"
                >
                  <motion.span
                    className="direction-icon"
                    animate={{ rotate: direction === "CLOCKWISE" ? 0 : 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    {direction === "CLOCKWISE" ? (
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
                      <path
                        d="M9.5 16.1 12 14.3M9.5 16.1 12 17.9"
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
                      <path
                        d="M14.5 16.1 12 14.3M14.5 16.1 12 17.9"
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
                    {direction === "CLOCKWISE" ? "Clockwise" : "Counterclockwise"}
                  </motion.span>
                </motion.button>
              </div>
            </div>

            <div className="button-row">
              <motion.button
                type="button"
                className="btn primary"
                onClick={handleCreateRoom}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                aria-label="Create room"
              >
                Create room
              </motion.button>
              <motion.button
                type="button"
                className="btn secondary"
                onClick={handleJoinRoom}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                aria-label="Join room"
                disabled={!isRoomCodeValid}
              >
                Join room
              </motion.button>
            </div>

            {publicState ? (
              isHost ? (
                <motion.button
                  type="button"
                  className="btn primary big"
                  onClick={handleStartGame}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Start game"
                  disabled={players.length < 2}
                >
                  Start game
                </motion.button>
              ) : (
                <div className="hint">Waiting for host to start...</div>
              )
            ) : (
              <div className="hint">Create a room or join one to start.</div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
