import type { ConnectionStatus } from "../lib/ws";

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

const statusSubtext: Partial<Record<ConnectionStatus, string>> = {
  connecting: "Waiting for the server instance to spin up...",
};

type ConnectionStatusProps = {
  status: ConnectionStatus;
};

export default function ConnectionStatusBadge({
  status,
}: ConnectionStatusProps) {
  return (
    <div className={`connection-pill ${status}`} aria-live="polite">
      <div className="connection-main">
        <span className={`status-indicator ${status}`} aria-hidden="true" />
        <span>Connection:</span>
        <strong>{statusLabels[status]}</strong>
      </div>
      {statusSubtext[status] && (
        <div className="connection-subtext">{statusSubtext[status]}</div>
      )}
    </div>
  );
}
