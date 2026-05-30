import {
  UNIFIED_REALTIME_CLIENT_FRAME_EVENT,
  UNIFIED_REALTIME_SERVER_FRAME_EVENT,
  UnifiedRealtimeClientMessageSchema,
  UnifiedRealtimeServerMessageSchema,
  decodeUnifiedRealtimeClientMessageFrame,
  encodeUnifiedRealtimeServerMessageFrame,
  type JsonValue,
  type UnifiedRealtimeClientMessage,
  type UnifiedRealtimeCoreState,
  type UnifiedRealtimeServerMessage,
  type UnifiedRealtimeTab,
  type UnifiedRealtimeThreadState,
} from "@farfield/unified-surface";
import type { Server, Socket } from "socket.io";

export const REALTIME_CLIENT_FRAME_EVENT = UNIFIED_REALTIME_CLIENT_FRAME_EVENT;
export const REALTIME_SERVER_FRAME_EVENT = UNIFIED_REALTIME_SERVER_FRAME_EVENT;

interface RealtimeClientContext {
  selectedThreadId: string | null;
  activeTab: UnifiedRealtimeTab;
}

interface RealtimeDebugState {
  traceStatus: UnifiedRealtimeCoreState["traceStatus"];
  history: UnifiedRealtimeCoreState["history"];
}

interface ThreadDeltaGroup {
  threadId: string;
  includeStreamEvents: boolean;
  sockets: Socket[];
}

type ThreadDeltaBuildResult =
  | {
      ok: true;
      group: ThreadDeltaGroup;
      state: UnifiedRealtimeThreadState | null;
    }
  | {
      ok: false;
      group: ThreadDeltaGroup;
      message: string;
    };

export interface RealtimeCoordinatorOptions {
  io: Server;
  buildCoreState: () => Promise<UnifiedRealtimeCoreState>;
  buildThreadState: (input: {
    threadId: string;
    includeStreamEvents: boolean;
  }) => Promise<UnifiedRealtimeThreadState | null>;
  buildDebugState: () => Promise<RealtimeDebugState>;
}

export class RealtimeCoordinator {
  private readonly io: Server;
  private readonly buildCoreState: RealtimeCoordinatorOptions["buildCoreState"];
  private readonly buildThreadState: RealtimeCoordinatorOptions["buildThreadState"];
  private readonly buildDebugState: RealtimeCoordinatorOptions["buildDebugState"];
  private readonly contextBySocketId = new Map<string, RealtimeClientContext>();
  private syncVersion = 0;
  private pendingCoreDelta = false;
  private pendingDebugDelta = false;
  private readonly pendingThreadIds = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;
  private coreStateInFlight: Promise<UnifiedRealtimeCoreState> | null = null;

  public constructor(options: RealtimeCoordinatorOptions) {
    this.io = options.io;
    this.buildCoreState = options.buildCoreState;
    this.buildThreadState = options.buildThreadState;
    this.buildDebugState = options.buildDebugState;
  }

  public start(): void {
    this.io.on("connection", (socket) => {
      this.contextBySocketId.set(socket.id, {
        selectedThreadId: null,
        activeTab: "chat",
      });

      socket.on(REALTIME_CLIENT_FRAME_EVENT, (payload: Uint8Array | ArrayBuffer) => {
        try {
          this.handleClientMessage(
            socket,
            decodeUnifiedRealtimeClientMessageFrame(payload),
          );
        } catch (error) {
          this.emitSyncError(
            socket,
            `Invalid realtime client frame: ${String(error)}`,
            "invalidFrame",
          );
        }
      });

      socket.on("disconnect", () => {
        this.contextBySocketId.delete(socket.id);
      });
    });
  }

  public queueCoreDelta(): void {
    this.pendingCoreDelta = true;
    this.scheduleFlush();
  }

  public queueDebugDelta(): void {
    this.pendingDebugDelta = true;
    this.scheduleFlush();
  }

  public queueThreadDelta(threadId: string): void {
    if (!threadId.trim()) {
      return;
    }
    this.pendingThreadIds.add(threadId);
    this.scheduleFlush();
  }

  public broadcastSyncError(message: string, code?: string): void {
    const nextVersion = this.nextSyncVersion();
    this.broadcastMessage({
      kind: "syncError",
      syncVersion: nextVersion,
      message,
      ...(code ? { code } : {}),
    });
  }

  private handleClientMessage(
    socket: Socket,
    payload: UnifiedRealtimeClientMessage,
  ): void {
    const parsed = UnifiedRealtimeClientMessageSchema.parse(payload);

    const current = this.contextBySocketId.get(socket.id) ?? {
      selectedThreadId: null,
      activeTab: "chat" as const,
    };

    if (parsed.kind === "hello") {
      this.contextBySocketId.set(socket.id, {
        selectedThreadId: parsed.selectedThreadId,
        activeTab: parsed.activeTab,
      });
      void this.sendSnapshot(socket);
      return;
    }

    if (parsed.kind === "selectionChanged") {
      this.contextBySocketId.set(socket.id, {
        selectedThreadId: parsed.selectedThreadId,
        activeTab: current.activeTab,
      });
      if (parsed.selectedThreadId) {
        this.queueThreadDelta(parsed.selectedThreadId);
      }
      return;
    }

    if (parsed.kind === "activeTabChanged") {
      this.contextBySocketId.set(socket.id, {
        selectedThreadId: current.selectedThreadId,
        activeTab: parsed.activeTab,
      });
      if (parsed.activeTab === "debug") {
        this.queueDebugDelta();
        if (current.selectedThreadId) {
          this.queueThreadDelta(current.selectedThreadId);
        }
      }
      return;
    }

    if (parsed.kind === "requestSnapshot") {
      void this.sendSnapshot(socket);
    }
  }

  private async sendSnapshot(socket: Socket): Promise<void> {
    try {
      const coreState = await this.getCoreState();
      const context = this.contextBySocketId.get(socket.id) ?? {
        selectedThreadId: null,
        activeTab: "chat" as const,
      };

      this.emitMessage(socket, {
        kind: "snapshot",
        syncVersion: this.nextSyncVersion(),
        core: coreState,
        selectedThread: null,
      });

      if (context.selectedThreadId) {
        void this.sendSelectedThreadDelta(
          socket,
          context.selectedThreadId,
          context.activeTab,
        );
      }
    } catch (error) {
      this.emitSyncError(socket, String(error), "snapshotFailed");
    }
  }

  private async sendSelectedThreadDelta(
    socket: Socket,
    threadId: string,
    activeTab: UnifiedRealtimeTab,
  ): Promise<void> {
    try {
      const thread = await this.buildThreadState({
        threadId,
        includeStreamEvents: activeTab === "debug",
      });
      const currentContext = this.contextBySocketId.get(socket.id);
      if (
        !thread ||
        currentContext?.selectedThreadId !== threadId ||
        currentContext.activeTab !== activeTab
      ) {
        return;
      }

      this.emitMessage(socket, {
        kind: "threadDelta",
        syncVersion: this.nextSyncVersion(),
        thread,
      });
    } catch (error) {
      this.emitSyncError(socket, String(error), "threadDeltaFailed");
    }
  }

  private getCoreState(): Promise<UnifiedRealtimeCoreState> {
    if (!this.coreStateInFlight) {
      this.coreStateInFlight = this.buildCoreState().finally(() => {
        this.coreStateInFlight = null;
      });
    }
    return this.coreStateInFlight;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPendingDeltas();
    }, 120);
    this.flushTimer.unref();
  }

  private async flushPendingDeltas(): Promise<void> {
    const shouldSendCore = this.pendingCoreDelta;
    const shouldSendDebug = this.pendingDebugDelta;
    const threadIds = new Set(this.pendingThreadIds);

    this.pendingCoreDelta = false;
    this.pendingDebugDelta = false;
    this.pendingThreadIds.clear();

    if (!shouldSendCore && !shouldSendDebug && threadIds.size === 0) {
      return;
    }

    const sockets = this.io.sockets.sockets;
    if (sockets.size === 0) {
      return;
    }

    const coreStatePromise = shouldSendCore
      ? this.getCoreState()
          .then((core) => ({ ok: true as const, core }))
          .catch((error) => ({ ok: false as const, error }))
      : null;

    const debugStatePromise = shouldSendDebug
      ? this.buildDebugState()
          .then((debug) => ({ ok: true as const, debug }))
          .catch((error) => ({ ok: false as const, error }))
      : null;

    const threadDeltaGroups = new Map<string, ThreadDeltaGroup>();

    if (threadIds.size > 0) {
      for (const [socketId, socket] of sockets.entries()) {
        const context = this.contextBySocketId.get(socketId);

        if (!context?.selectedThreadId) {
          continue;
        }

        if (!threadIds.has(context.selectedThreadId)) {
          continue;
        }

        const includeStreamEvents = context.activeTab === "debug";
        const streamKey = includeStreamEvents ? "withStream" : "withoutStream";
        const cacheKey = `${context.selectedThreadId}:${streamKey}`;
        const existingGroup = threadDeltaGroups.get(cacheKey);
        if (existingGroup) {
          existingGroup.sockets.push(socket);
        } else {
          threadDeltaGroups.set(cacheKey, {
            threadId: context.selectedThreadId,
            includeStreamEvents,
            sockets: [socket],
          });
        }
      }
    }

    const threadDeltaResultsPromise = Promise.all(
      Array.from(threadDeltaGroups.values()).map(
        async (group): Promise<ThreadDeltaBuildResult> => {
          try {
            return {
              ok: true,
              group,
              state: await this.buildThreadState({
                threadId: group.threadId,
                includeStreamEvents: group.includeStreamEvents,
              }),
            };
          } catch (error) {
            return {
              ok: false,
              group,
              message: String(error),
            };
          }
        },
      ),
    );

    if (coreStatePromise) {
      const coreResult = await coreStatePromise;
      if (!coreResult.ok) {
        this.broadcastSyncError(
          coreResult.error instanceof Error
            ? coreResult.error.message
            : String(coreResult.error),
          "coreDeltaFailed",
        );
      } else {
        this.emitMessageToSockets(sockets.values(), {
          kind: "coreDelta",
          syncVersion: this.nextSyncVersion(),
          core: coreResult.core,
        });
      }
    }

    if (debugStatePromise) {
      const debugResult = await debugStatePromise;
      if (!debugResult.ok) {
        this.broadcastSyncError(
          debugResult.error instanceof Error
            ? debugResult.error.message
            : String(debugResult.error),
          "debugDeltaFailed",
        );
      } else {
        const debugSockets: Socket[] = [];
        for (const [socketId, socket] of sockets.entries()) {
          const context = this.contextBySocketId.get(socketId) ?? {
            selectedThreadId: null,
            activeTab: "chat" as const,
          };
          if (context.activeTab !== "debug") {
            continue;
          }

          debugSockets.push(socket);
        }

        if (debugSockets.length > 0) {
          this.emitMessageToSockets(debugSockets, {
            kind: "debugDelta",
            syncVersion: this.nextSyncVersion(),
            traceStatus: debugResult.debug.traceStatus,
            history: debugResult.debug.history,
          });
        }
      }
    }

    const threadDeltaResults = await threadDeltaResultsPromise;
    for (const result of threadDeltaResults) {
      if (!result.ok) {
        this.emitMessageToSockets(result.group.sockets, {
          kind: "syncError",
          syncVersion: this.nextSyncVersion(),
          message: result.message,
          code: "threadDeltaFailed",
        });
        continue;
      }
      if (!result.state) {
        continue;
      }
      this.emitMessageToSockets(result.group.sockets, {
        kind: "threadDelta",
        syncVersion: this.nextSyncVersion(),
        thread: result.state,
      });
    }
  }

  private emitSyncError(
    socket: Socket,
    message: string,
    code?: string,
    details?: JsonValue,
  ): void {
    this.emitMessage(socket, {
      kind: "syncError",
      syncVersion: this.nextSyncVersion(),
      message,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
    });
  }

  private emitMessage(socket: Socket, message: UnifiedRealtimeServerMessage): void {
    const parsed = UnifiedRealtimeServerMessageSchema.parse(message);
    this.emitParsedMessage(socket, parsed);
  }

  private emitMessageToSockets(
    sockets: Iterable<Socket>,
    message: UnifiedRealtimeServerMessage,
  ): void {
    const parsed = UnifiedRealtimeServerMessageSchema.parse(message);
    let encodedFrame: Uint8Array | null = null;
    for (const socket of sockets) {
      encodedFrame ??= encodeUnifiedRealtimeServerMessageFrame(parsed);
      socket.emit(REALTIME_SERVER_FRAME_EVENT, encodedFrame);
    }
  }

  private broadcastMessage(message: UnifiedRealtimeServerMessage): void {
    this.emitMessageToSockets(this.io.sockets.sockets.values(), message);
  }

  private emitParsedMessage(socket: Socket, message: UnifiedRealtimeServerMessage): void {
    socket.emit(
      REALTIME_SERVER_FRAME_EVENT,
      encodeUnifiedRealtimeServerMessageFrame(message),
    );
  }

  private nextSyncVersion(): number {
    this.syncVersion += 1;
    return this.syncVersion;
  }
}
