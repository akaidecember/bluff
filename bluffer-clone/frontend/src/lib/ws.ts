import type { ClientMessage, ServerMessage } from "../types/messages";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type MessageHandler = (message: ServerMessage) => void;

type StatusHandler = (status: ConnectionStatus) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();

  connect(url: string): void {
    if (this.socket) {
      this.socket.close();
    }
    this.updateStatus("connecting");
    this.socket = new WebSocket(url);
    this.socket.onopen = () => this.updateStatus("connected");
    this.socket.onclose = () => this.updateStatus("disconnected");
    this.socket.onerror = () => this.updateStatus("error");
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage;
        this.handlers.forEach((handler) => handler(data));
      } catch {
        // Ignore malformed messages
      }
    };
  }

  send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private updateStatus(status: ConnectionStatus): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }
}
