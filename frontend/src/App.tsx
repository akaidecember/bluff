import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";

import ConnectionStatusBadge from "./components/ConnectionStatus";
import Landing from "./pages/Landing";
import GamePage from "./pages/Game";
import LobbyPage from "./pages/Lobby";
import { WebSocketClient, type ConnectionStatus } from "./lib/ws";
import type { PrivateState, PublicState, ServerMessage } from "./types/messages";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";
//Insert own IP addr. for local hosted within the same wifi addr.
//const WS_URL = "ws://<IP_ADDR>/ws";

type ChallengeResolvedMessage = Extract<ServerMessage, { type: "challenge_resolved" }>;

export default function App() {
  const client = useMemo(() => new WebSocketClient(), []);
  const navigate = useNavigate();
  const location = useLocation();
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
      }
      if (message.type === "challenge_resolved") {
        const resultText = message.picked_matches_claim
          ? `Bluff failed. ${message.challenger_id} takes the pile.`
          : `Bluff caught. ${message.claimant_id} takes the pile.`;
        setLastEvent(`${resultText} Picked ${message.picked_card}.`);
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
  }, [client, navigate]);

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

  const activeRoomCode = publicState?.room_code ?? roomCode;

  const shell = (child: ReactNode) => (
    <>
      <div className="felt-overlay" aria-hidden="true" />
      <div className="app-shell">
        <header className="app-header">
          <ConnectionStatusBadge
            status={status}
            onRetry={() => {
              setLastError(null);
              client.connect(WS_URL);
            }}
          />
          <div className="message-stack">
            {lastError && <p className="banner error">Server: {lastError}</p>}
            {lastEvent && <p className="banner info">Event: {lastEvent}</p>}
          </div>
        </header>
        {child}
      </div>
    </>
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
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
              playerId={playerId}
              roomCode={activeRoomCode}
              publicState={publicState}
              privateState={privateState}
              lastChallenge={lastChallenge}
              onSend={(message) => client.send(message)}
            />
          )}
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </AnimatePresence>
  );
}
