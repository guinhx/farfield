import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNIFIED_REALTIME_CLIENT_FRAME_EVENT,
  decodeUnifiedRealtimeClientMessageFrame,
} from "@farfield/unified-surface";
import { createUnifiedRealtimeSocket } from "../src/lib/realtime-socket";

type MockSocketPayload = Uint8Array | ArrayBuffer;
type MockSocketListener = (payload?: MockSocketPayload) => void;

const socketMock = vi.hoisted(() => {
  class MockSocket {
    public readonly emitted: Array<{
      event: string;
      payload: MockSocketPayload | undefined;
    }> = [];

    private readonly listeners = new Map<string, MockSocketListener[]>();

    public on(event: string, listener: MockSocketListener): this {
      const current = this.listeners.get(event) ?? [];
      current.push(listener);
      this.listeners.set(event, current);
      return this;
    }

    public emit(event: string, payload?: MockSocketPayload): boolean {
      this.emitted.push({ event, payload });
      return true;
    }

    public connect(): void {
      this.emitToListeners("connect");
    }

    public disconnect(): void {
      this.emitToListeners("disconnect");
    }

    public reset(): void {
      this.emitted.splice(0, this.emitted.length);
      this.listeners.clear();
    }

    private emitToListeners(event: string): void {
      const listeners = this.listeners.get(event) ?? [];
      for (const listener of listeners) {
        listener();
      }
    }
  }

  const socket = new MockSocket();
  return {
    socket,
    io: vi.fn(() => socket),
  };
});

vi.mock("socket.io-client", () => ({
  io: socketMock.io,
}));

function firstRealtimeClientMessage() {
  const payload = socketMock.socket.emitted.find(
    (entry) => entry.event === UNIFIED_REALTIME_CLIENT_FRAME_EVENT,
  )?.payload;
  if (!payload) {
    throw new Error("Missing realtime client frame");
  }
  return decodeUnifiedRealtimeClientMessageFrame(payload);
}

describe("createUnifiedRealtimeSocket", () => {
  beforeEach(() => {
    socketMock.socket.reset();
    socketMock.io.mockClear();
  });

  it("does not emit control frames before the socket is connected", () => {
    const socket = createUnifiedRealtimeSocket({
      socketUrl: "ws://127.0.0.1:4311/api/unified/ws",
      onMessage() {},
    });

    socket.send({ kind: "requestSnapshot" });

    expect(socketMock.socket.emitted).toHaveLength(0);
  });

  it("emits control frames while connected and stops after disconnect", () => {
    const socket = createUnifiedRealtimeSocket({
      socketUrl: "ws://127.0.0.1:4311/api/unified/ws",
      onMessage() {},
    });

    socket.connect();
    socket.send({ kind: "requestSnapshot" });
    expect(firstRealtimeClientMessage()).toEqual({ kind: "requestSnapshot" });

    socket.disconnect();
    socket.send({ kind: "requestSnapshot" });

    expect(socketMock.socket.emitted).toHaveLength(1);
  });
});
