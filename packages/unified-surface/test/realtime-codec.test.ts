import { describe, expect, it } from "vitest";
import {
  UNIFIED_FEATURE_IDS,
  UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP,
  buildUnifiedThreadWindow,
  decodeUnifiedPayloadFrame,
  decodeUnifiedRealtimeClientMessageFrame,
  decodeUnifiedRealtimeServerMessageFrame,
  encodeUnifiedPayloadFrame,
  encodeUnifiedRealtimeClientMessageFrame,
  encodeUnifiedRealtimeServerMessageFrame,
  selectUnifiedRealtimeTransportCodec,
  UnifiedRealtimeCoreStateSchema,
  UnifiedRealtimeServerMessageSchema,
  type UnifiedRealtimeServerMessage
} from "../src/index.js";

function buildAvailableFeatures(): Record<string, { status: "available" }> {
  const features: Record<string, { status: "available" }> = {};
  for (const featureId of UNIFIED_FEATURE_IDS) {
    features[featureId] = { status: "available" };
  }
  return features;
}

function buildLargeRealtimeMessage(): UnifiedRealtimeServerMessage {
  const repeatedText = "large transcript line ".repeat(8_000);
  const thread = {
    id: "thread-1",
    provider: "codex" as const,
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: [
          {
            id: "item-1",
            type: "agentMessage" as const,
            text: repeatedText
          }
        ]
      }
    ],
    requests: [],
    latestCollaborationMode: null,
    latestModel: "gpt-5.3-codex",
    latestReasoningEffort: "medium",
    cwd: "D:/Development/GitHub/farfield",
    source: "codex"
  };
  return UnifiedRealtimeServerMessageSchema.parse({
    kind: "snapshot",
    syncVersion: 7,
    core: UnifiedRealtimeCoreStateSchema.parse({
      health: {
        appReady: true,
        ipcConnected: true,
        ipcInitialized: true,
        gitCommit: "abc123",
        lastError: null,
        historyCount: 1,
        threadOwnerCount: 0
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
              canListProjectDirectories: true
            },
            projectDirectories: ["D:/Development/GitHub/farfield"]
          }
        ],
        defaultAgentId: "codex"
      },
      sidebar: {
        rows: [
          {
            id: "thread-1",
            provider: "codex",
            preview: repeatedText.slice(0, 160),
            title: "Large thread",
            createdAt: 1,
            updatedAt: 2,
            cwd: "D:/Development/GitHub/farfield",
            source: "codex"
          }
        ],
        errors: {
          codex: null,
          opencode: null
        }
      },
      rateLimits: null,
      traceStatus: null,
      history: []
    }),
    selectedThread: {
      threadId: "thread-1",
      readThreadWindow: buildUnifiedThreadWindow(thread, { maxItems: 170 }),
      liveState: {
        ownerClientId: null,
        conversationStateWindow: null,
        liveStateError: null
      },
      streamEvents: []
    }
  });
}

describe("unified realtime codec", () => {
  it("selects the protobuf gzip codec when the client supports it", () => {
    expect(
      selectUnifiedRealtimeTransportCodec([
        UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP
      ])
    ).toBe(UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP);
  });

  it("round trips a server message through the binary frame", () => {
    const message = buildLargeRealtimeMessage();
    const frame = encodeUnifiedRealtimeServerMessageFrame(message);
    const decoded = decodeUnifiedRealtimeServerMessageFrame(frame);

    expect(decoded).toEqual(message);
    expect(frame.length).toBeGreaterThan(0);
  });

  it("rejects malformed protobuf frames", () => {
    expect(() => decodeUnifiedRealtimeServerMessageFrame(new Uint8Array([8]))).toThrow(
      "Unexpected end of realtime protobuf varint"
    );
  });

  it("round trips a generic payload through the binary frame", () => {
    const payload = {
      ok: true,
      thread: {
        id: "thread-1",
        turns: [
          {
            status: "completed",
            items: [
              {
                type: "agentMessage",
                text: "compact payload"
              }
            ]
          }
        ]
      }
    };

    const frame = encodeUnifiedPayloadFrame(payload);
    expect(decodeUnifiedPayloadFrame(frame)).toEqual(payload);
  });

  it("round trips a client message through the binary frame", () => {
    const message = {
      kind: "hello",
      selectedThreadId: "thread-1",
      activeTab: "chat",
      supportedCodecs: [UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP]
    } as const;

    const frame = encodeUnifiedRealtimeClientMessageFrame(message);
    expect(decodeUnifiedRealtimeClientMessageFrame(frame)).toEqual(message);
  });
});
