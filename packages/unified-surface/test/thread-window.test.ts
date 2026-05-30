import { describe, expect, it } from "vitest";
import {
  UnifiedThreadSchema,
  buildUnifiedThreadWindow,
  materializeUnifiedThreadWindow,
  resolveUnifiedThreadContentRef,
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

  it("moves large command output into a content ref", () => {
    const output = "large output line\n".repeat(128);
    const thread = UnifiedThreadSchema.parse({
      ...buildThread(),
      turns: [
        {
          id: "turn-cmd",
          status: "completed",
          items: [
            {
              id: "item-cmd",
              type: "commandExecution",
              command: "bun test",
              status: "completed",
              aggregatedOutput: output,
              exitCode: 0,
            },
          ],
        },
      ],
    });
    const window = buildUnifiedThreadWindow(thread, {
      maxItems: 10,
      contentRefByteLimit: 128,
    });
    const item = window.itemsById["item-cmd"];

    expect(item?.type).toBe("commandExecution");
    if (!item || item.type !== "commandExecution") {
      throw new Error("Expected command item");
    }

    expect(item.aggregatedOutput).not.toBe(output);
    expect(item.aggregatedOutputRef?.kind).toBe("commandOutput");
    expect(Object.keys(window.contentRefs)).toEqual([
      item.aggregatedOutputRef?.id,
    ]);

    if (!item.aggregatedOutputRef) {
      throw new Error("Expected command output ref");
    }
    const resolved = resolveUnifiedThreadContentRef(
      thread,
      item.aggregatedOutputRef.id,
    );
    expect(resolved.value).toBe(output);
  });

  it("moves large diffs and tool payloads into content refs", () => {
    const diff = [
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,1 +1,1 @@",
      `+${"const value = 1;\n".repeat(32)}`,
    ].join("\n");
    const mcpArguments = { code: "console.log('hello');\n".repeat(64) };
    const dynamicContentItems = [
      {
        type: "inputText",
        text: "dynamic output\n".repeat(64),
      },
    ];
    const thread = UnifiedThreadSchema.parse({
      ...buildThread(),
      turns: [
        {
          id: "turn-heavy",
          status: "completed",
          items: [
            {
              id: "item-file",
              type: "fileChange",
              status: "completed",
              changes: [
                {
                  path: "src/app.ts",
                  kind: { type: "modify" },
                  diff,
                },
              ],
            },
            {
              id: "item-mcp",
              type: "mcpToolCall",
              server: "node_repl",
              tool: "js",
              status: "completed",
              arguments: mcpArguments,
              result: {
                content: [
                  {
                    type: "text",
                    text: "tool result\n".repeat(64),
                  },
                ],
              },
            },
            {
              id: "item-dynamic",
              type: "dynamicToolCall",
              tool: "apply_patch",
              arguments: { patch: "patch body\n".repeat(64) },
              status: "completed",
              contentItems: dynamicContentItems,
              success: true,
            },
          ],
        },
      ],
    });
    const window = buildUnifiedThreadWindow(thread, {
      maxItems: 10,
      contentRefByteLimit: 128,
    });
    const fileItem = window.itemsById["item-file"];
    const mcpItem = window.itemsById["item-mcp"];
    const dynamicItem = window.itemsById["item-dynamic"];

    expect(fileItem?.type).toBe("fileChange");
    expect(mcpItem?.type).toBe("mcpToolCall");
    expect(dynamicItem?.type).toBe("dynamicToolCall");
    if (
      !fileItem ||
      fileItem.type !== "fileChange" ||
      !mcpItem ||
      mcpItem.type !== "mcpToolCall" ||
      !dynamicItem ||
      dynamicItem.type !== "dynamicToolCall"
    ) {
      throw new Error("Expected heavy item refs");
    }

    const fileDiffRef = fileItem.changes[0]?.diffRef;
    expect(fileDiffRef?.kind).toBe("fileDiff");
    expect(mcpItem.argumentsRef?.kind).toBe("mcpArguments");
    expect(mcpItem.resultRef?.kind).toBe("mcpResult");
    expect(dynamicItem.argumentsRef?.kind).toBe("dynamicArguments");
    expect(dynamicItem.contentItemsRef?.kind).toBe("dynamicContentItems");

    if (
      !fileDiffRef ||
      !mcpItem.argumentsRef ||
      !mcpItem.resultRef ||
      !dynamicItem.argumentsRef ||
      !dynamicItem.contentItemsRef
    ) {
      throw new Error("Expected all heavy refs");
    }

    expect(resolveUnifiedThreadContentRef(thread, fileDiffRef.id).value).toBe(
      diff,
    );
    expect(
      resolveUnifiedThreadContentRef(thread, mcpItem.argumentsRef.id).value,
    ).toEqual(mcpArguments);
    expect(
      resolveUnifiedThreadContentRef(thread, dynamicItem.contentItemsRef.id)
        .value,
    ).toEqual(dynamicContentItems);
  });
});
