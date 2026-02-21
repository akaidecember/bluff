import type { ConnectionStatus } from "../lib/ws";

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

const statusSubtext: Partial<Record<ConnectionStatus, string>> = {
  connecting: "Warming up server...",
  disconnected: "Waking up the server...",
  error: "Unable to reach server.",
};

type ConnectionStatusProps = {
  status: ConnectionStatus;
  onRetry?: () => void;
};

export default function ConnectionStatusBadge({ status, onRetry }: ConnectionStatusProps) {
  const showRetry = (status === "disconnected" || status === "error") && onRetry;
  return (
    <div className={`connection-pill ${status}`} aria-live="polite">
      <div className="connection-main">
        <span className={`status-indicator ${status}`} aria-hidden="true" />
        <span>Connection:</span>
        <strong>{statusLabels[status]}</strong>
        {showRetry && (
          <button type="button" className="connection-retry" onClick={onRetry} aria-label="Retry connection">
            Retry
          </button>
        )}
      </div>
      {statusSubtext[status] && (
        <div className="connection-subtext">{statusSubtext[status]}</div>
      )}
    </div>
  );
}
