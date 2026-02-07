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
  const createRoom = () => {
    onSend({
      type: "create_room",
      player_id: playerId,
      display_name: displayName,
      deck_count: deckCount,
      direction,
    });
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

  return (
    <main>
      <h1>Bluffer Lobby</h1>
      <fieldset>
        <legend>Identity</legend>
        <label>
          Player ID
          <input
            value={playerId}
            onChange={(event) => onChangePlayerId(event.target.value)}
            placeholder="player-1"
          />
        </label>
        <label>
          Display Name
          <input
            value={displayName}
            onChange={(event) => onChangeDisplayName(event.target.value)}
            placeholder="Your name"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Room</legend>
        <label>
          Room Code
          <input
            value={roomCode}
            onChange={(event) => onChangeRoomCode(event.target.value)}
            placeholder="ABCDE"
          />
        </label>
        <label>
          Decks
          <select value={deckCount} onChange={(event) => onChangeDeckCount(Number(event.target.value))}>
            <option value={1}>1 Deck</option>
            <option value={2}>2 Decks</option>
          </select>
        </label>
        <label>
          Direction
          <select value={direction} onChange={(event) => onChangeDirection(event.target.value)}>
            <option value="CLOCKWISE">Clockwise</option>
            <option value="COUNTERCLOCKWISE">Counterclockwise</option>
          </select>
        </label>
        <div>
          <button type="button" onClick={createRoom}>
            Create Room
          </button>
          <button type="button" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      </fieldset>

      {publicState && (
        <section>
          <h2>Room Snapshot</h2>
          <p>Room: {publicState.room_code}</p>
          <p>Phase: {publicState.phase}</p>
          <p>Players: {publicState.players.length}</p>
          <p>Decks: {publicState.deck_count}</p>
          <p>Direction: {publicState.direction}</p>
          {publicState.host_id === playerId && (
            <button type="button" onClick={startGame} disabled={!canStart}>
              Start Game
            </button>
          )}
        </section>
      )}
    </main>
  );
}
