import { useEffect, useMemo, useState } from "react";

import ConnectionStatusBadge from "./components/ConnectionStatus";
import { WebSocketClient, type ConnectionStatus } from "./lib/ws";
import Game from "./screens/Game";
import Lobby from "./screens/Lobby";
import type { PrivateState, PublicState, ServerMessage } from "./types/messages";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";
//Insert own IP addr. for local hosted within the same wifi addr.
//const WS_URL = "ws://<IP_ADDR>/ws";

type Screen = "lobby" | "game"; 

export default function App() {
  const client = useMemo(() => new WebSocketClient(), []);
  const [screen, setScreen] = useState<Screen>("lobby");
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
        setScreen("lobby");
      }
      if (message.type === "game_started") {
        setScreen("game");
        setLastEvent("Game started.");
      }
      if (message.type === "challenge_resolved") {
        const resultText = message.picked_matches_claim
          ? `Bluff failed. ${message.challenger_id} takes the pile.`
          : `Bluff caught. ${message.claimant_id} takes the pile.`;
        setLastEvent(`${resultText} Picked ${message.picked_card}.`);
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
  }, [client]);

  useEffect(() => {
    if (publicState && publicState.phase !== "WAITING_FOR_PLAYERS") {
      setScreen("game");
    }
  }, [publicState]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <ConnectionStatusBadge status={status} />
        <div className="message-stack">
          {lastError && <p className="banner error">Server: {lastError}</p>}
          {lastEvent && <p className="banner info">Event: {lastEvent}</p>}
        </div>
      </header>

      {screen === "lobby" ? (
        <Lobby
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
      ) : (
        <Game
          playerId={playerId}
          roomCode={roomCode}
          publicState={publicState}
          privateState={privateState}
          onSend={(message) => client.send(message)}
        />
      )}
    </div>
  );
}
