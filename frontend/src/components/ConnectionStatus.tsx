import type { ConnectionStatus } from "../lib/ws";

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

type ConnectionStatusProps = {
  status: ConnectionStatus;
};

export default function ConnectionStatusBadge({
  status,
}: ConnectionStatusProps) {
  return (
    <p className={`connection-pill ${status}`}>
      Connection: <strong>{statusLabels[status]}</strong>
    </p>
  );
}
