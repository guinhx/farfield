import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UNIFIED_BINARY_HTTP_CONTENT_TYPE,
  JsonValueSchema,
  UnifiedThreadSchema,
  buildUnifiedThreadWindow,
  encodeUnifiedPayloadFrame,
} from "@farfield/unified-surface";
import {
  getHealth,
  listSidebarThreads,
  readThread,
  readThreadContentRef,
} from "../src/lib/api";

describe("api transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts binary protobuf gzip responses", async () => {
    const payload = {
      ok: true,
      state: {
        appReady: true,
        ipcConnected: true,
        ipcInitialized: true,
        gitCommit: "abc123",
        lastError: null,
        historyCount: 0,
        threadOwnerCount: 0,
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Accept")).toBe(UNIFIED_BINARY_HTTP_CONTENT_TYPE);
        const frame = encodeUnifiedPayloadFrame(payload);
        const body = new ArrayBuffer(frame.byteLength);
        new Uint8Array(body).set(frame);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": UNIFIED_BINARY_HTTP_CONTENT_TYPE,
          },
        });
      }),
    );

    await expect(getHealth()).resolves.toEqual(payload);
  });

  it("materializes data-oriented thread windows from read responses", async () => {
    const thread = UnifiedThreadSchema.parse({
      id: "thread-1",
      provider: "codex",
      turns: [
        {
          id: "turn-1",
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userMessage",
              content: [{ type: "text", text: "older" }],
            },
          ],
        },
        {
          id: "turn-2",
          status: "completed",
          items: [
            {
              id: "item-2",
              type: "agentMessage",
              text: "newer",
            },
          ],
        },
      ],
      requests: [],
      latestCollaborationMode: null,
      latestModel: "gpt-5.3-codex",
      latestReasoningEffort: "medium",
    });
    const threadWindow = buildUnifiedThreadWindow(thread, { maxItems: 1 });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/unified/thread/thread-1");
        expect(url.searchParams.get("provider")).toBe("codex");
        expect(url.searchParams.get("includeTurns")).toBe("1");
        expect(url.searchParams.get("itemLimit")).toBe("1");
        const headers = new Headers(init?.headers);
        expect(headers.get("Accept")).toBe(UNIFIED_BINARY_HTTP_CONTENT_TYPE);
        const frame = encodeUnifiedPayloadFrame(
          JsonValueSchema.parse({
            ok: true,
            shape: "threadWindow",
            threadWindow,
          }),
        );
        const body = new ArrayBuffer(frame.byteLength);
        new Uint8Array(body).set(frame);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": UNIFIED_BINARY_HTTP_CONTENT_TYPE,
          },
        });
      }),
    );

    const result = await readThread("thread-1", {
      includeTurns: true,
      provider: "codex",
      itemLimit: 1,
    });

    expect(result.thread.turns.map((turn) => turn.id)).toEqual(["turn-2"]);
    expect(result.window?.range.hasMoreBefore).toBe(true);
  });

  it("reads content refs through the binary API", async () => {
    const ref = {
      id: "thread:thread-1:turn:turn-1:item:item-1:field:aggregatedOutput",
      kind: "commandOutput",
      contentType: "text",
      byteLength: 12,
      preview: "hello",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe(
          "/api/unified/thread/thread-1/content/thread%3Athread-1%3Aturn%3Aturn-1%3Aitem%3Aitem-1%3Afield%3AaggregatedOutput",
        );
        expect(url.searchParams.get("provider")).toBe("codex");
        const headers = new Headers(init?.headers);
        expect(headers.get("Accept")).toBe(UNIFIED_BINARY_HTTP_CONTENT_TYPE);
        const frame = encodeUnifiedPayloadFrame(
          JsonValueSchema.parse({
            ok: true,
            ref,
            value: "hello world!",
          }),
        );
        const body = new ArrayBuffer(frame.byteLength);
        new Uint8Array(body).set(frame);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": UNIFIED_BINARY_HTTP_CONTENT_TYPE,
          },
        });
      }),
    );

    await expect(
      readThreadContentRef("thread-1", ref.id, { provider: "codex" }),
    ).resolves.toEqual({
      ref,
      value: "hello world!",
    });
  });

  it("sends provider cursors when reading sidebar pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/unified/sidebar");
        expect(url.searchParams.get("limit")).toBe("80");
        expect(url.searchParams.get("codexCursor")).toBe("codex-next");
        expect(url.searchParams.get("opencodeCursor")).toBe("opencode-next");
        const headers = new Headers(init?.headers);
        expect(headers.get("Accept")).toBe(UNIFIED_BINARY_HTTP_CONTENT_TYPE);
        const frame = encodeUnifiedPayloadFrame(
          JsonValueSchema.parse({
            ok: true,
            rows: [],
            cursors: {
              codex: null,
              opencode: null,
            },
            errors: {
              codex: null,
              opencode: null,
            },
          }),
        );
        const body = new ArrayBuffer(frame.byteLength);
        new Uint8Array(body).set(frame);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": UNIFIED_BINARY_HTTP_CONTENT_TYPE,
          },
        });
      }),
    );

    await expect(
      listSidebarThreads({
        limit: 80,
        archived: false,
        all: false,
        maxPages: 1,
        cursors: {
          codex: "codex-next",
          opencode: "opencode-next",
        },
      }),
    ).resolves.toEqual({
      rows: [],
      cursors: {
        codex: null,
        opencode: null,
      },
      errors: {
        codex: null,
        opencode: null,
      },
      refreshing: false,
    });
  });
});
