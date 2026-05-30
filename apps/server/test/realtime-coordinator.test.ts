import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP,
  UNIFIED_FEATURE_IDS,
  buildUnifiedThreadWindow,
  decodeUnifiedRealtimeServerMessageFrame,
  encodeUnifiedRealtimeClientMessageFrame,
  UnifiedRealtimeCoreStateSchema,
  UnifiedRealtimeThreadStateSchema,
  type UnifiedRealtimeClientMessage,
  type UnifiedRealtimeCoreState,
  type UnifiedRealtimeServerMessage,
  type UnifiedRealtimeThreadState,
} from "@farfield/unified-surface";
import { Server as SocketServer } from "socket.io";
import { io as createSocketClient, type Socket } from "socket.io-client";
import {
  REALTIME_CLIENT_FRAME_EVENT,
  REALTIME_SERVER_FRAME_EVENT,
  RealtimeCoordinator,
} from "../src/realtime/coordinator.js";

function waitForEvent(client: Socket, event: "connect" | "disconnect") {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for socket event: ${event}`));
    }, 4_000);
    client.once(event, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function waitForServerMessage(
  client: Socket,
  predicate: (message: UnifiedRealtimeServerMessage) => boolean,
) {
  return waitForServerFrame(client, predicate);
}

function waitForServerFrame(
  client: Socket,
  predicate: (message: UnifiedRealtimeServerMessage) => boolean,
) {
  return new Promise<UnifiedRealtimeServerMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for realtime server frame"));
    }, 4_000);
    const listener = (payload: Uint8Array) => {
      const parsed = decodeUnifiedRealtimeServerMessageFrame(payload);
      if (!predicate(parsed)) {
        return;
      }
      clearTimeout(timeout);
      client.off(REALTIME_SERVER_FRAME_EVENT, listener);
      resolve(parsed);
    };
    client.on(REALTIME_SERVER_FRAME_EVENT, listener);
  });
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createDeferredThreadState() {
  let resolveThreadState = (_value: UnifiedRealtimeThreadState): void => {};
  const promise = new Promise<UnifiedRealtimeThreadState>((resolve) => {
    resolveThreadState = resolve;
  });
  return {
    promise,
    resolve: resolveThreadState,
  };
}

function emitClientMessage(
  client: Socket,
  message: UnifiedRealtimeClientMessage,
): void {
  client.emit(
    REALTIME_CLIENT_FRAME_EVENT,
    encodeUnifiedRealtimeClientMessageFrame(message),
  );
}

function buildAvailableFeatures(): Record<string, { status: "available" }> {
  const features: Record<string, { status: "available" }> = {};
  for (const featureId of UNIFIED_FEATURE_IDS) {
    features[featureId] = { status: "available" };
  }
  return features;
}

function buildCoreState(threadId = "thread-1"): UnifiedRealtimeCoreState {
  return UnifiedRealtimeCoreStateSchema.parse({
    health: {
      appReady: true,
      ipcConnected: true,
      ipcInitialized: true,
      gitCommit: "abc123",
      lastError: null,
      historyCount: 1,
      threadOwnerCount: 0,
    },
    agents: {
      agents: [
        {
          id: "codex",
          label: "Codex",
          enabled: true,
          connected: true,
          features: buildAvailableFeatures(),
          capabilities: {
            canListModels: true,
            canListCollaborationModes: true,
            canSetCollaborationMode: true,
            canSubmitUserInput: true,
            canReadLiveState: true,
            canReadStreamEvents: true,
            canListProjectDirectories: true,
          },
          projectDirectories: ["/tmp/project"],
        },
      ],
      defaultAgentId: "codex",
    },
    sidebar: {
      rows: [
        {
          id: threadId,
          provider: "codex",
          preview: "Realtime thread",
          title: "Realtime thread",
          createdAt: 1,
          updatedAt: 2,
          cwd: "/tmp/project",
          source: "codex",
        },
      ],
      cursors: {
        codex: null,
        opencode: null,
      },
      errors: {
        codex: null,
        opencode: null,
      },
    },
    rateLimits: null,
    traceStatus: null,
    history: [],
  });
}

function buildThreadState(threadId: string): UnifiedRealtimeThreadState {
  const thread = {
    id: threadId,
    provider: "codex" as const,
    turns: [],
    requests: [],
    latestCollaborationMode: null,
    latestModel: "gpt-5.3-codex",
    latestReasoningEffort: "medium",
    cwd: "/tmp/project",
    source: "codex",
  };
  return UnifiedRealtimeThreadStateSchema.parse({
    threadId,
    readThreadWindow: buildUnifiedThreadWindow(thread, { maxItems: 170 }),
    liveState: {
      ownerClientId: null,
      conversationStateWindow: null,
      liveStateError: null,
    },
    streamEvents: [],
  });
}

describe("RealtimeCoordinator", () => {
  const openClients: Socket[] = [];
  let httpServer: http.Server | null = null;
  let ioServer: SocketServer | null = null;

  afterEach(async () => {
    for (const client of openClients.splice(0)) {
      if (client.connected) {
        client.disconnect();
      }
    }

    if (ioServer) {
      await new Promise<void>((resolve) => {
        ioServer?.close(() => resolve());
      });
      ioServer = null;
    }

    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer?.close(() => resolve());
      });
      httpServer = null;
    }
  });

  async function setupCoordinator(options?: {
    buildCoreState?: () => Promise<UnifiedRealtimeCoreState>;
    buildThreadState?: (input: {
      threadId: string;
      includeStreamEvents: boolean;
    }) => Promise<UnifiedRealtimeThreadState | null>;
  }) {
    httpServer = http.createServer();
    ioServer = new SocketServer(httpServer, {
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      httpServer?.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve local server address");
    }
    const port = address.port;

    const coordinator = new RealtimeCoordinator({
      io: ioServer,
      buildCoreState: options?.buildCoreState ?? (async () => buildCoreState()),
      buildThreadState:
        options?.buildThreadState ??
        (async ({ threadId }) => buildThreadState(threadId)),
      buildDebugState: async () => ({
        traceStatus: null,
        history: [],
      }),
    });
    coordinator.start();

    const createClient = () => {
      const client = createSocketClient(`http://127.0.0.1:${port}`, {
        transports: ["websocket"],
        reconnection: false,
      });
      openClients.push(client);
      return client;
    };

    return {
      coordinator,
      createClient,
    };
  }

  it("sends snapshot after hello with selected thread", async () => {
    const { createClient } = await setupCoordinator();
    const client = createClient();
    const snapshots: UnifiedRealtimeServerMessage[] = [];

    client.on(REALTIME_SERVER_FRAME_EVENT, (payload: Uint8Array) => {
      const parsed = decodeUnifiedRealtimeServerMessageFrame(payload);
      if (parsed.kind === "snapshot") {
        snapshots.push(parsed);
      }
    });

    await waitForEvent(client, "connect");
    await sleep(50);
    expect(snapshots).toHaveLength(0);

    const helloSnapshotPromise = waitForServerMessage(
      client,
      (message) => message.kind === "snapshot",
    );
    const threadDeltaPromise = waitForServerMessage(client, (message) => {
      return (
        message.kind === "threadDelta" &&
        message.thread.threadId === "thread-1"
      );
    });
    emitClientMessage(client, {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
    });
    const helloSnapshot = await helloSnapshotPromise;
    const threadDelta = await threadDeltaPromise;
    expect(helloSnapshot.kind).toBe("snapshot");
    if (helloSnapshot.kind !== "snapshot") {
      return;
    }
    expect(helloSnapshot.selectedThread).toBeNull();
    expect(helloSnapshot.syncVersion).toBeGreaterThan(0);
    expect(threadDelta.kind).toBe("threadDelta");
  });

  it("sends protobuf gzip frames when the client advertises support", async () => {
    const { createClient } = await setupCoordinator();
    const client = createClient();
    await waitForEvent(client, "connect");

    const framePromise = waitForServerFrame(client, (message) => {
      return message.kind === "snapshot";
    });
    const threadDeltaPromise = waitForServerFrame(client, (message) => {
      return (
        message.kind === "threadDelta" &&
        message.thread.threadId === "thread-1"
      );
    });
    emitClientMessage(client, {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
      supportedCodecs: [UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP],
    });

    const snapshot = await framePromise;
    const threadDelta = await threadDeltaPromise;
    expect(snapshot.kind).toBe("snapshot");
    if (snapshot.kind !== "snapshot") {
      return;
    }
    expect(snapshot.selectedThread).toBeNull();
    expect(threadDelta.kind).toBe("threadDelta");
  });

  it("accepts protobuf gzip client frames", async () => {
    const { createClient } = await setupCoordinator();
    const client = createClient();
    await waitForEvent(client, "connect");

    const snapshotPromise = waitForServerFrame(client, (message) => {
      return message.kind === "snapshot";
    });
    client.emit(
      REALTIME_CLIENT_FRAME_EVENT,
      encodeUnifiedRealtimeClientMessageFrame({
        kind: "hello",
        selectedThreadId: "thread-1",
        activeTab: "chat",
        supportedCodecs: [UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP],
      }),
    );

    const snapshot = await snapshotPromise;
    expect(snapshot.kind).toBe("snapshot");
  });

  it("does not block the core snapshot on a slow selected thread build", async () => {
    const deferredThreadState = createDeferredThreadState();
    const { createClient } = await setupCoordinator({
      buildThreadState: async () => deferredThreadState.promise,
    });
    const client = createClient();
    await waitForEvent(client, "connect");

    const snapshotPromise = waitForServerMessage(
      client,
      (message) => message.kind === "snapshot",
    );
    emitClientMessage(client, {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.kind).toBe("snapshot");
    if (snapshot.kind !== "snapshot") {
      return;
    }
    expect(snapshot.selectedThread).toBeNull();

    const threadDeltaPromise = waitForServerMessage(
      client,
      (message) => message.kind === "threadDelta",
    );
    deferredThreadState.resolve(buildThreadState("thread-1"));
    const threadDelta = await threadDeltaPromise;
    expect(threadDelta.kind).toBe("threadDelta");
  });

  it("rejects invalid client frame with syncError", async () => {
    const { createClient } = await setupCoordinator();
    const client = createClient();
    await waitForEvent(client, "connect");

    const syncErrorPromise = waitForServerMessage(
      client,
      (message) =>
        message.kind === "syncError" && message.code === "invalidFrame",
    );
    client.emit(REALTIME_CLIENT_FRAME_EVENT, new Uint8Array([8]));

    const syncError = await syncErrorPromise;
    expect(syncError.kind).toBe("syncError");
    if (syncError.kind !== "syncError") {
      return;
    }
    expect(syncError.code).toBe("invalidFrame");
    expect(syncError.message).toContain("Invalid realtime client frame");
  });

  it("coalesces burst thread updates into one delta per selected thread", async () => {
    const { coordinator, createClient } = await setupCoordinator();
    const client = createClient();
    const threadMessages: UnifiedRealtimeServerMessage[] = [];

    client.on(REALTIME_SERVER_FRAME_EVENT, (payload: Uint8Array) => {
      const parsed = decodeUnifiedRealtimeServerMessageFrame(payload);
      if (parsed.kind === "threadDelta") {
        threadMessages.push(parsed);
      }
    });

    await waitForEvent(client, "connect");

    emitClientMessage(client, {
      kind: "selectionChanged",
      selectedThreadId: "thread-1",
    });
    await sleep(50);

    coordinator.queueThreadDelta("thread-1");
    coordinator.queueThreadDelta("thread-1");
    coordinator.queueThreadDelta("thread-1");
    coordinator.queueThreadDelta("thread-2");
    await sleep(300);

    expect(threadMessages).toHaveLength(1);
    expect(threadMessages[0]).toMatchObject({
      kind: "threadDelta",
      thread: {
        threadId: "thread-1",
      },
    });
  });

  it("shares one thread state build across clients on the same selected thread", async () => {
    let threadBuildCount = 0;
    const { coordinator, createClient } = await setupCoordinator({
      buildThreadState: async ({ threadId }) => {
        threadBuildCount += 1;
        await sleep(40);
        return buildThreadState(threadId);
      },
    });
    const firstClient = createClient();
    const secondClient = createClient();

    await waitForEvent(firstClient, "connect");
    await waitForEvent(secondClient, "connect");
    const firstSnapshotPromise = waitForServerMessage(
      firstClient,
      (message) => message.kind === "snapshot",
    );
    const secondSnapshotPromise = waitForServerMessage(
      secondClient,
      (message) => message.kind === "snapshot",
    );
    emitClientMessage(firstClient, {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
    });
    emitClientMessage(secondClient, {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
    });
    const firstInitialThreadDeltaPromise = waitForServerMessage(
      firstClient,
      (message) => message.kind === "threadDelta",
    );
    const secondInitialThreadDeltaPromise = waitForServerMessage(
      secondClient,
      (message) => message.kind === "threadDelta",
    );
    await Promise.all([
      firstSnapshotPromise,
      secondSnapshotPromise,
      firstInitialThreadDeltaPromise,
      secondInitialThreadDeltaPromise,
    ]);
    threadBuildCount = 0;

    const firstDeltaPromise = waitForServerMessage(
      firstClient,
      (message) => message.kind === "threadDelta",
    );
    const secondDeltaPromise = waitForServerMessage(
      secondClient,
      (message) => message.kind === "threadDelta",
    );
    coordinator.queueThreadDelta("thread-1");

    await Promise.all([firstDeltaPromise, secondDeltaPromise]);
    expect(threadBuildCount).toBe(1);
  });

  it("sends core deltas when a selected thread delta fails", async () => {
    const { coordinator, createClient } = await setupCoordinator({
      buildThreadState: async () => {
        throw new Error("thread build failed");
      },
    });
    const client = createClient();
    await waitForEvent(client, "connect");

    const coreDeltaPromise = waitForServerMessage(
      client,
      (message) => message.kind === "coreDelta",
    );
    const threadErrorPromise = waitForServerMessage(
      client,
      (message) =>
        message.kind === "syncError" && message.code === "threadDeltaFailed",
    );

    emitClientMessage(client, {
      kind: "selectionChanged",
      selectedThreadId: "thread-1",
    });
    coordinator.queueCoreDelta();

    const coreDelta = await coreDeltaPromise;
    const threadError = await threadErrorPromise;
    expect(coreDelta.kind).toBe("coreDelta");
    expect(threadError.kind).toBe("syncError");
  });

  it("keeps healthy thread deltas when another selected thread fails", async () => {
    const { coordinator, createClient } = await setupCoordinator({
      buildThreadState: async ({ threadId }) => {
        if (threadId === "thread-bad") {
          throw new Error("thread build failed");
        }
        return buildThreadState(threadId);
      },
    });
    const firstClient = createClient();
    const secondClient = createClient();

    await waitForEvent(firstClient, "connect");
    await waitForEvent(secondClient, "connect");

    const firstErrorPromise = waitForServerMessage(
      firstClient,
      (message) =>
        message.kind === "syncError" && message.code === "threadDeltaFailed",
    );
    const secondDeltaPromise = waitForServerMessage(
      secondClient,
      (message) =>
        message.kind === "threadDelta" &&
        message.thread.threadId === "thread-good",
    );

    emitClientMessage(firstClient, {
      kind: "selectionChanged",
      selectedThreadId: "thread-bad",
    });
    emitClientMessage(secondClient, {
      kind: "selectionChanged",
      selectedThreadId: "thread-good",
    });
    coordinator.queueThreadDelta("thread-bad");
    coordinator.queueThreadDelta("thread-good");

    const firstError = await firstErrorPromise;
    const secondDelta = await secondDeltaPromise;
    expect(firstError.kind).toBe("syncError");
    expect(secondDelta.kind).toBe("threadDelta");
  });

  it("sends a fresh snapshot with incremented version after reconnect", async () => {
    const { createClient } = await setupCoordinator();

    const firstClient = createClient();
    const firstSnapshotPromise = waitForServerMessage(
      firstClient,
      (message) => message.kind === "snapshot",
    );
    await waitForEvent(firstClient, "connect");
    emitClientMessage(firstClient, {
      kind: "hello",
      selectedThreadId: null,
      activeTab: "chat",
    });
    const firstSnapshot = await firstSnapshotPromise;

    firstClient.disconnect();
    await sleep(50);

    const secondClient = createClient();
    const secondSnapshotPromise = waitForServerMessage(
      secondClient,
      (message) => message.kind === "snapshot",
    );
    await waitForEvent(secondClient, "connect");
    emitClientMessage(secondClient, {
      kind: "hello",
      selectedThreadId: null,
      activeTab: "chat",
    });
    const secondSnapshot = await secondSnapshotPromise;

    expect(secondSnapshot.kind).toBe("snapshot");
    expect(secondSnapshot.syncVersion).toBeGreaterThan(firstSnapshot.syncVersion);
  });

  it("shares one in-flight core state build across concurrent snapshots", async () => {
    let coreBuildCount = 0;
    const { createClient } = await setupCoordinator({
      buildCoreState: async () => {
        coreBuildCount += 1;
        await sleep(80);
        return buildCoreState();
      },
    });
    const firstClient = createClient();
    const secondClient = createClient();

    const firstSnapshotPromise = waitForServerMessage(
      firstClient,
      (message) => message.kind === "snapshot",
    );
    const secondSnapshotPromise = waitForServerMessage(
      secondClient,
      (message) => message.kind === "snapshot",
    );
    await waitForEvent(firstClient, "connect");
    await waitForEvent(secondClient, "connect");

    emitClientMessage(firstClient, {
      kind: "hello",
      selectedThreadId: null,
      activeTab: "chat",
    });
    emitClientMessage(secondClient, {
      kind: "hello",
      selectedThreadId: null,
      activeTab: "chat",
    });

    await Promise.all([firstSnapshotPromise, secondSnapshotPromise]);
    expect(coreBuildCount).toBe(1);
  });
});
