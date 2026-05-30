import {
  UNIFIED_REALTIME_CLIENT_FRAME_EVENT,
  UNIFIED_REALTIME_SERVER_FRAME_EVENT,
  UnifiedRealtimeClientMessageSchema,
  encodeUnifiedRealtimeClientMessageFrame,
  decodeUnifiedRealtimeServerMessageFrame,
  type UnifiedRealtimeClientMessage,
  type UnifiedRealtimeServerMessage,
} from "@farfield/unified-surface";
import { io, type Socket } from "socket.io-client";

type UnifiedRealtimeBinaryPayload = Uint8Array | ArrayBuffer;

export interface UnifiedRealtimeSocket {
  connect(): void;
  disconnect(): void;
  send(message: UnifiedRealtimeClientMessage): void;
}

export function createUnifiedRealtimeSocket(input: {
  socketUrl: string;
  onMessage: (message: UnifiedRealtimeServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onProtocolError?: (message: string) => void;
}): UnifiedRealtimeSocket {
  const parsedSocketUrl = new URL(input.socketUrl);
  const socket: Socket = io(
    `${parsedSocketUrl.protocol}//${parsedSocketUrl.host}`,
    {
      path: parsedSocketUrl.pathname,
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    },
  );
  let connected = false;

  socket.on("connect", () => {
    connected = true;
    input.onConnect?.();
  });

  socket.on("disconnect", () => {
    connected = false;
    input.onDisconnect?.();
  });

  socket.on(
    UNIFIED_REALTIME_SERVER_FRAME_EVENT,
    (payload: UnifiedRealtimeBinaryPayload) => {
      try {
        input.onMessage(decodeUnifiedRealtimeServerMessageFrame(payload));
      } catch (error) {
        input.onProtocolError?.(`Invalid realtime frame: ${String(error)}`);
      }
    },
  );

  return {
    connect(): void {
      socket.connect();
    },
    disconnect(): void {
      socket.disconnect();
    },
    send(message: UnifiedRealtimeClientMessage): void {
      if (!connected) {
        return;
      }
      const parsed = UnifiedRealtimeClientMessageSchema.parse(message);
      socket.emit(
        UNIFIED_REALTIME_CLIENT_FRAME_EVENT,
        encodeUnifiedRealtimeClientMessageFrame(parsed),
      );
    },
  };
}
