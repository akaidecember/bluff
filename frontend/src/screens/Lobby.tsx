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
    <main className="screen lobby-screen">
      <section className="panel hero-panel">
        <h1>Bluffer Lobby</h1>
        <p>Host picks deck count and direction. Game supports 2 to 6 players.</p>
      </section>

      <section className="panel form-panel">
        <h2>Identity</h2>
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

      <section className="panel form-panel">
        <h2>Room Controls</h2>
        <div className="field-grid">
          <label htmlFor="room-code">Room Code</label>
          <input
            id="room-code"
            value={roomCode}
            onChange={(event) => onChangeRoomCode(event.target.value)}
            placeholder="ABCDE"
          />

          <label htmlFor="deck-count">Decks</label>
          <select id="deck-count" value={deckCount} onChange={(event) => onChangeDeckCount(Number(event.target.value))}>
            <option value={1}>1 deck (54 cards incl. jokers)</option>
            <option value={2}>2 decks (108 cards incl. jokers)</option>
          </select>

          <label htmlFor="turn-direction">Direction</label>
          <select id="turn-direction" value={direction} onChange={(event) => onChangeDirection(event.target.value)}>
            <option value="CLOCKWISE">Clockwise</option>
            <option value="COUNTERCLOCKWISE">Counterclockwise</option>
          </select>
        </div>

        <div className="button-row">
          <button type="button" className="primary" onClick={createRoom}>
            Create Room
          </button>
          <button type="button" className="secondary" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      </section>

      {publicState && (
        <section className="panel snapshot-panel">
          <h2>Room Snapshot</h2>
          <div className="status-grid">
            <p>
              <span>Room</span>
              <strong>{publicState.room_code}</strong>
            </p>
            <p>
              <span>Phase</span>
              <strong>{publicState.phase}</strong>
            </p>
            <p>
              <span>Players</span>
              <strong>{publicState.players.length}</strong>
            </p>
            <p>
              <span>Decks</span>
              <strong>{publicState.deck_count}</strong>
            </p>
            <p>
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
      )}
    </main>
  );
}
