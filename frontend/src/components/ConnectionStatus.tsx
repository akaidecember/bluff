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
    <div className="connection-mini" aria-live="polite" title={`Connection: ${statusLabels[status]}`}>
      <span className={`connection-dot ${status}`} aria-hidden="true" />
      <span className="sr-only">Connection: {statusLabels[status]}</span>
      {showRetry && (
        <button type="button" className="connection-retry-dot" onClick={onRetry} aria-label="Retry connection">
          Retry
        </button>
      )}
    </div>
  );
}
