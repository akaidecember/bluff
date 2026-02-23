import type { ConnectionStatus } from "../lib/ws";

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Waking Up the Server...",
  connecting: "Waking Up the Server...",
  connected: "Connected",
  error: "Waking Up the Server...",
};

type ConnectionStatusProps = {
  status: ConnectionStatus;
  onRetry?: () => void;
  className?: string;
  showLabel?: boolean;
};

export default function ConnectionStatusBadge({
  status,
  onRetry,
  className = "",
  showLabel = true,
}: ConnectionStatusProps) {
  const showRetry = (status === "disconnected" || status === "error") && onRetry;
  const label = statusLabels[status];
  return (
    <div
      className={`connection-mini ${className}`.trim()}
      aria-live="polite"
      title={`Connection: ${label}`}
    >
      <span className={`connection-dot ${status}`} aria-hidden="true" />
      {showLabel && <span className="connection-label">{label}</span>}
      <span className="sr-only">Connection: {label}</span>
      {showRetry && (
        <button type="button" className="connection-retry-dot" onClick={onRetry} aria-label="Retry connection">
          Retry
        </button>
      )}
    </div>
  );
}
