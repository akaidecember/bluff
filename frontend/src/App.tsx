import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Landing from "./pages/Landing";
import GamePage from "./pages/Game";
import GamePhaserPage from "./pages/GamePhaser";
import LobbyPage from "./pages/Lobby";
import WorkInProgress from "./pages/WorkInProgress";
import { WebSocketClient, type ConnectionStatus } from "./lib/ws";
import type { ClientMessage, PrivateState, PublicState, ServerMessage } from "./types/messages";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";
//Insert own IP addr. for local hosted within the same wifi addr.
//const WS_URL = "ws://<IP_ADDR>/ws";

type ChallengeResolvedMessage = Extract<ServerMessage, { type: "challenge_resolved" }>;

const SCREENSHOT_PLAYER_ID = "player-1";
const SCREENSHOT_PUBLIC_STATE: PublicState = {
  room_code: "DEMO",
  phase: "CLAIM_MADE",
  host_id: "player-1",
  deck_count: 1,
  direction: "CLOCKWISE",
  players: [
    { player_id: "player-1", display_name: "Player One", hand_count: 27 },
    { player_id: "player-2", display_name: "Nendnd", hand_count: 27 },
    { player_id: "player-3", display_name: "Maya", hand_count: 26 },
    { player_id: "player-4", display_name: "Ravi", hand_count: 28 },
  ],
  current_player_id: "player-1",
  last_claim: { player_id: "player-2", rank: "5", count: 3 },
  round_rank: "5",
  round_starter_id: "player-2",
  last_play_count: 3,
  pile_count: 12,
  discard_pile_count: 24,
  finished_order: [],
  loser_id: null,
  standings: [],
};
const SCREENSHOT_PRIVATE_STATE: PrivateState = {
  room_code: "DEMO",
  player_id: "player-1",
  hand: [
    "AS",
    "AD",
    "AH",
    "AC",
    "2S",
    "2D",
    "2H",
    "2C",
    "3S",
    "3D",
    "3H",
    "3C",
    "4S",
    "4D",
    "4H",
    "4C",
    "5S",
    "5D",
    "5H",
    "5C",
    "6S",
    "6D",
    "6H",
    "6C",
    "7S",
    "7D",
    "JKR",
  ],
};

export default function App() {
  const client = useMemo(() => new WebSocketClient(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const isGameRoute = location.pathname === "/game" || location.pathname === "/game-phaser";
  const isScreenshotMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.has("screenshot") || params.has("demo");
  }, [location.search]);
  const isScreenshotGame = isGameRoute && isScreenshotMode;
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [playerId, setPlayerId] = useState("player-1");
  const [displayName, setDisplayName] = useState("Player One");
  const [roomCode, setRoomCode] = useState("");
  const [deckCount, setDeckCount] = useState(1);
  const [direction, setDirection] = useState("CLOCKWISE");
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [lastChallenge, setLastChallenge] = useState<ChallengeResolvedMessage | null>(null);
  const challengeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isScreenshotMode) {
      setStatus("connected");
      return;
    }
    client.connect(WS_URL);
    const unsubscribeStatus = client.onStatus(setStatus);
    const unsubscribeMessages = client.onMessage((message: ServerMessage) => {
      if (message.type === "public_state") {
        setPublicState(message.state);
      }
      if (message.type === "private_state") {
        setPrivateState(message.state);
      }
      if (message.type === "room_created" || message.type === "room_joined" || message.type === "room_already_joined") {
        setRoomCode(message.room_code);
        navigate("/lobby", { replace: false });
      }
      if (message.type === "game_started") {
        navigate("/game", { replace: false });
        setLastEvent("Game started.");
        client.send({ type: "sync_state", room_code: message.room_code, player_id: playerId });
      }
      if (message.type === "challenge_resolved") {
        if (message.picked_matches_claim) {
          setLastEvent(`Bluff failed. ${message.challenger_id} takes the pile.`);
        } else {
          setLastEvent(`Bluff caught. ${message.claimant_id} takes the pile. Picked ${message.picked_card}.`);
        }
        setLastChallenge(message);
      }
      if (message.type === "pile_discarded") {
        setLastEvent("Round ended by pass. Center pile discarded.");
      }
      if (message.type === "error" || message.type === "invalid_action") {
        setLastError(message.message);
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
      client.close();
    };
  }, [client, navigate, playerId, isScreenshotMode]);

  useEffect(() => {
    if (publicState && publicState.phase !== "WAITING_FOR_PLAYERS" && location.pathname !== "/game") {
      navigate("/game", { replace: false });
    }
  }, [publicState, navigate, location.pathname]);

  useEffect(() => {
    if (!lastChallenge) {
      return;
    }
    if (challengeTimeoutRef.current) {
      window.clearTimeout(challengeTimeoutRef.current);
    }
    const timeoutId = window.setTimeout(() => {
      setLastChallenge(null);
      challengeTimeoutRef.current = null;
    }, 3000);
    challengeTimeoutRef.current = timeoutId;
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastChallenge]);

  useEffect(() => {
    if (!lastEvent) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLastEvent(null);
    }, 2000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastEvent]);

  const effectivePublicState = isScreenshotGame ? SCREENSHOT_PUBLIC_STATE : publicState;
  const effectivePrivateState = isScreenshotGame ? SCREENSHOT_PRIVATE_STATE : privateState;
  const activeRoomCode = effectivePublicState?.room_code ?? roomCode;
  const effectivePlayerId = isScreenshotGame ? SCREENSHOT_PLAYER_ID : playerId;
  const effectiveStatus = isScreenshotGame ? "connected" : status;
  const effectiveOnSend = useMemo<(message: ClientMessage) => void>(() => {
    if (isScreenshotGame) {
      return () => {};
    }
    return (message: ClientMessage) => client.send(message);
  }, [client, isScreenshotGame]);

  const shell = (child: ReactNode) => (
    <>
      <div className="felt-overlay" aria-hidden="true" />
      <div className={`app-shell${isGameRoute ? " game-shell" : ""}`}>
        {lastError && (
          <header className="app-header">
            <div className="message-stack">
              <p className="banner error">Server: {lastError}</p>
            </div>
          </header>
        )}
        <div className="game-content">{child}</div>
        {lastEvent && (
          <div className="toast" role="status" aria-live="polite">
            {lastEvent}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Landing />} />
          <Route path="/how" element={<WorkInProgress />} />
          <Route path="/privacy" element={<WorkInProgress />} />
          <Route path="/credits" element={<WorkInProgress />} />
          <Route
            path="/lobby"
            element={shell(
              <LobbyPage
                playerId={playerId}
                displayName={displayName}
                roomCode={roomCode}
                deckCount={deckCount}
                direction={direction}
                publicState={publicState}
                status={status}
                onRetryConnection={() => {
                  setLastError(null);
                  client.connect(WS_URL);
                }}
                onChangePlayerId={setPlayerId}
                onChangeDisplayName={setDisplayName}
                onChangeRoomCode={setRoomCode}
                onChangeDeckCount={setDeckCount}
                onChangeDirection={setDirection}
                onSend={(message) => client.send(message)}
              />
            )}
          />
          <Route
            path="/game"
            element={shell(
              <GamePage
                playerId={effectivePlayerId}
                roomCode={activeRoomCode}
                publicState={effectivePublicState}
                privateState={effectivePrivateState}
                lastChallenge={lastChallenge}
                status={effectiveStatus}
                onRetryConnection={() => {
                  setLastError(null);
                  client.connect(WS_URL);
                }}
                onSend={effectiveOnSend}
              />
            )}
          />
          <Route
            path="/game-phaser"
            element={shell(
              <GamePhaserPage
                playerId={effectivePlayerId}
                roomCode={activeRoomCode}
                publicState={effectivePublicState}
                privateState={effectivePrivateState}
                lastChallenge={lastChallenge}
                status={effectiveStatus}
                onRetryConnection={() => {
                  setLastError(null);
                  client.connect(WS_URL);
                }}
                onSend={effectiveOnSend}
              />
            )}
          />
          <Route path="*" element={<Landing />} />
        </Routes>
      </AnimatePresence>
      <p className="global-wip-notice" role="note">
        Work in progress: this game may contain bugs.
      </p>
    </>
  );
}
