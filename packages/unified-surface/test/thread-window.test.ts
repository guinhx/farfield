import { describe, expect, it } from "vitest";
import {
  UnifiedThreadSchema,
  buildUnifiedThreadWindow,
  materializeUnifiedThreadWindow,
  type UnifiedThread,
} from "../src/index";

function buildThread(): UnifiedThread {
  return UnifiedThreadSchema.parse({
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
            content: [{ type: "text", text: "one" }],
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
            text: "two",
          },
          {
            id: "item-3",
            type: "agentMessage",
            text: "three",
          },
        ],
      },
      {
        id: "turn-3",
        status: "in_progress",
        items: [
          {
            id: "item-4",
            type: "agentMessage",
            text: "four",
          },
        ],
      },
    ],
    requests: [],
    createdAt: 10,
    updatedAt: 20,
    title: "Thread",
    latestCollaborationMode: null,
    latestModel: "gpt-5.3-codex",
    latestReasoningEffort: "medium",
    cwd: "D:/Development/GitHub/farfield",
    source: "codex",
  });
}

describe("thread window", () => {
  it("normalizes only the tail turns needed by the item budget", () => {
    const window = buildUnifiedThreadWindow(buildThread(), { maxItems: 3 });

    expect(window.range).toEqual({
      totalTurns: 3,
      totalItems: 4,
      startTurnIndex: 1,
      endTurnIndexExclusive: 3,
      includedTurnCount: 2,
      includedItemCount: 3,
      maxItems: 3,
      hasMoreBefore: true,
      hasMoreAfter: false,
    });
    expect(window.turnOrder).toEqual(["turn-2", "turn-3"]);
    expect(window.itemIdsByTurnId["turn-2"]).toEqual(["item-2", "item-3"]);
    expect(window.itemsById["item-4"]?.type).toBe("agentMessage");
  });

  it("materializes a strict UnifiedThread from a normalized window", () => {
    const window = buildUnifiedThreadWindow(buildThread(), { maxItems: 3 });
    const materialized = materializeUnifiedThreadWindow(window);

    expect(materialized.id).toBe("thread-1");
    expect(materialized.turns.map((turn) => turn.id)).toEqual([
      "turn-2",
      "turn-3",
    ]);
    expect(materialized.turns[0]?.items.map((item) => item.id)).toEqual([
      "item-2",
      "item-3",
    ]);
    expect(materialized.requests).toEqual([]);
    expect(materialized.latestModel).toBe("gpt-5.3-codex");
  });

  it("rejects duplicate item ids before building the window", () => {
    const thread = buildThread();
    const duplicateThread = UnifiedThreadSchema.parse({
      ...thread,
      turns: [
        ...thread.turns,
        {
          id: "turn-4",
          status: "completed",
          items: [
            {
              id: "item-4",
              type: "agentMessage",
              text: "duplicate",
            },
          ],
        },
      ],
    });

    expect(() =>
      buildUnifiedThreadWindow(duplicateThread, { maxItems: 10 }),
    ).toThrow("duplicate item id item-4");
  });
});
