import { memo, useEffect, useRef, useState } from "react";
import {
  Code2,
  Keyboard,
  MousePointer2,
  Search,
  Wrench,
} from "lucide-react";
import { z } from "zod";
import {
  JsonValueSchema,
  type JsonValue,
  type UnifiedContentRef,
  type UnifiedItem,
} from "@farfield/unified-surface";
import { formatDurationSeconds } from "@/lib/tool-call-ui";
import {
  ToolCallDetailCode,
  ToolCallDetailRows,
  ToolCallDetails,
  ToolCallDetailText,
} from "./ToolCallDetails";
import { ToolCallRow } from "./ToolCallRow";

type McpToolItem = Extract<UnifiedItem, { type: "mcpToolCall" }>;
type ContentRefLoader = (ref: UnifiedContentRef) => Promise<JsonValue>;

const NodeReplJsArgumentsSchema = z
  .object({
    title: z.string().optional(),
    timeout_ms: z.number().int().positive().optional(),
    code: z.string(),
  })
  .passthrough();

const ComputerUseArgumentsSchema = z
  .object({
    app: z.string().optional(),
    element_index: z.string().optional(),
    text: z.string().optional(),
    key: z.string().optional(),
    value: z.string().optional(),
  })
  .passthrough();

const ToolSearchArgumentsSchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().positive().optional(),
  })
  .passthrough();

const TextContentSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();

const ImageContentSchema = z
  .object({
    type: z.literal("image"),
    mimeType: z.string().optional(),
  })
  .passthrough();

interface DetailRow {
  label: string;
  value: string;
}

function formatToolTitle(item: McpToolItem): string {
  if (item.server === "node_repl" && item.tool === "js") {
    const parsed = NodeReplJsArgumentsSchema.safeParse(item.arguments);
    return parsed.success && parsed.data.title ? parsed.data.title : "Node REPL";
  }

  if (item.server === "computer-use") {
    switch (item.tool) {
      case "get_app_state":
        return "Inspect app";
      case "click":
        return "Click";
      case "type_text":
        return "Type text";
      case "press_key":
        return "Press key";
      case "set_value":
        return "Set value";
      case "list_apps":
        return "List apps";
      default:
        return item.tool;
    }
  }

  if (item.server === "tool_search") {
    return "Search tools";
  }

  return `${item.server}/${item.tool}`;
}

function iconForTool(item: McpToolItem): React.ElementType {
  if (item.server === "node_repl" && item.tool === "js") return Code2;
  if (item.server === "tool_search") return Search;
  if (item.server === "computer-use") {
    switch (item.tool) {
      case "click":
        return MousePointer2;
      case "type_text":
      case "press_key":
      case "set_value":
        return Keyboard;
      default:
        return Wrench;
    }
  }
  return Wrench;
}

function iconClassForTool(item: McpToolItem): string {
  if (item.server === "node_repl" && item.tool === "js") {
    return "text-violet-400";
  }
  if (item.server === "tool_search") {
    return "text-blue-400";
  }
  if (item.server === "computer-use") {
    return "text-amber-400";
  }
  return "text-muted-foreground/65";
}

function buildDetailRows(item: McpToolItem): DetailRow[] {
  if (item.server === "node_repl" && item.tool === "js") {
    const parsed = NodeReplJsArgumentsSchema.safeParse(item.arguments);
    if (!parsed.success) return [];

    return [
      { label: "tool", value: `${item.server}/${item.tool}` },
      ...(parsed.data.timeout_ms
        ? [{ label: "timeout", value: formatDurationSeconds(parsed.data.timeout_ms) }]
        : []),
    ];
  }

  if (item.server === "computer-use") {
    const parsed = ComputerUseArgumentsSchema.safeParse(item.arguments);
    if (!parsed.success) return [];

    return [
      { label: "tool", value: `${item.server}/${item.tool}` },
      ...(parsed.data.app ? [{ label: "app", value: parsed.data.app }] : []),
      ...(parsed.data.element_index
        ? [{ label: "element", value: parsed.data.element_index }]
        : []),
      ...(parsed.data.key ? [{ label: "key", value: parsed.data.key }] : []),
      ...(parsed.data.value
        ? [{ label: "value", value: parsed.data.value }]
        : []),
      ...(parsed.data.text
        ? [{ label: "text", value: parsed.data.text }]
        : []),
    ];
  }

  if (item.server === "tool_search") {
    const parsed = ToolSearchArgumentsSchema.safeParse(item.arguments);
    if (!parsed.success) return [];

    return [
      { label: "tool", value: `${item.server}/${item.tool}` },
      ...(parsed.data.query ? [{ label: "query", value: parsed.data.query }] : []),
      ...(parsed.data.limit ? [{ label: "limit", value: String(parsed.data.limit) }] : []),
    ];
  }

  return [{ label: "tool", value: `${item.server}/${item.tool}` }];
}

function firstTextResult(item: McpToolItem): string | null {
  const firstContent = item.result?.content[0];
  const parsed = TextContentSchema.safeParse(firstContent);
  if (!parsed.success) return null;
  return parsed.data.text;
}

function imageResultCount(item: McpToolItem): number {
  return item.result?.content.filter((content) => ImageContentSchema.safeParse(content).success)
    .length ?? 0;
}

function resultPartCount(item: McpToolItem): number {
  return item.result?.content.length ?? 0;
}

function codeForNodeRepl(item: McpToolItem): string | null {
  const parsed = NodeReplJsArgumentsSchema.safeParse(item.arguments);
  if (!parsed.success) return null;
  return parsed.data.code;
}

function statusTextForTool(item: McpToolItem): { text: string; className: string } | null {
  if (item.status === "inProgress") {
    return { text: "running", className: "reasoning-shimmer" };
  }
  if (item.status === "failed") {
    return { text: "failed", className: "text-danger/80" };
  }
  return null;
}

function McpToolBlockComponent({
  item,
  className,
  onLoadContentRef,
}: {
  item: McpToolItem;
  className?: string;
  onLoadContentRef: ContentRefLoader;
}) {
  const [expanded, setExpanded] = useState(item.status === "inProgress");
  const [loadedArgumentsText, setLoadedArgumentsText] = useState<string | null>(null);
  const [loadedResultText, setLoadedResultText] = useState<string | null>(null);
  const [loadingRefIds, setLoadingRefIds] = useState<Record<string, boolean>>({});
  const [failedRefIds, setFailedRefIds] = useState<Record<string, boolean>>({});
  const lastStatusRef = useRef(item.status);

  useEffect(() => {
    if (item.status === "completed" && lastStatusRef.current === "inProgress") {
      setExpanded(false);
    }
    lastStatusRef.current = item.status;
  }, [item.status]);

  useEffect(() => {
    const refs: UnifiedContentRef[] = [];
    if (item.argumentsRef !== undefined) {
      refs.push(item.argumentsRef);
    }
    if (item.resultRef !== undefined) {
      refs.push(item.resultRef);
    }

    if (!expanded || refs.length === 0) {
      return;
    }

    for (const ref of refs) {
      const alreadyLoaded =
        (ref.id === item.argumentsRef?.id && loadedArgumentsText !== null) ||
        (ref.id === item.resultRef?.id && loadedResultText !== null);
      if (alreadyLoaded || loadingRefIds[ref.id]) {
        continue;
      }

      setLoadingRefIds((current) => ({ ...current, [ref.id]: true }));
      setFailedRefIds((current) => ({ ...current, [ref.id]: false }));
      void onLoadContentRef(ref)
        .then((value) => {
          const text = JSON.stringify(JsonValueSchema.parse(value), null, 2);
          if (ref.id === item.argumentsRef?.id) {
            setLoadedArgumentsText(text);
          }
          if (ref.id === item.resultRef?.id) {
            setLoadedResultText(text);
          }
        })
        .catch(() => {
          setFailedRefIds((current) => ({ ...current, [ref.id]: true }));
        })
        .finally(() => {
          setLoadingRefIds((current) => ({ ...current, [ref.id]: false }));
        });
    }
  }, [
    expanded,
    item.argumentsRef,
    item.resultRef,
    loadedArgumentsText,
    loadedResultText,
    loadingRefIds,
    onLoadContentRef,
  ]);

  const ToolIcon = iconForTool(item);
  const title = formatToolTitle(item);
  const details = buildDetailRows(item);
  const nodeCode = codeForNodeRepl(item);
  const textResult = firstTextResult(item);
  const argumentsRefId = item.argumentsRef?.id ?? null;
  const resultRefId = item.resultRef?.id ?? null;
  const imageCount = imageResultCount(item);
  const contentCount = resultPartCount(item);
  const statusText = statusTextForTool(item);
  const hasLazyDetails = item.argumentsRef !== undefined || item.resultRef !== undefined;

  return (
    <div className={`${className ?? ""} text-sm`}>
      <ToolCallRow
        icon={ToolIcon}
        iconClassName={iconClassForTool(item)}
        title={title}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        meta={
          <>
            {statusText && (
              <span className={statusText.className}>{statusText.text}</span>
            )}
            {item.durationMs != null && (
              <span>{formatDurationSeconds(item.durationMs)}</span>
            )}
          </>
        }
      >
        {(details.length > 0 ||
          nodeCode ||
          item.error?.message ||
          textResult ||
          hasLazyDetails) && (
          <ToolCallDetails>
          <ToolCallDetailRows rows={details} />

          {argumentsRefId && loadingRefIds[argumentsRefId] && (
            <ToolCallDetailText>Loading arguments...</ToolCallDetailText>
          )}

          {argumentsRefId && failedRefIds[argumentsRefId] && (
            <ToolCallDetailText tone="danger">
              Could not load arguments.
            </ToolCallDetailText>
          )}

          {loadedArgumentsText && (
            <ToolCallDetailCode
              label="Arguments"
              code={loadedArgumentsText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {nodeCode && (
            <ToolCallDetailCode
              label="Code"
              code={nodeCode}
              language="javascript"
            />
          )}

          {item.error?.message && (
            <ToolCallDetailText tone="danger">
              {item.error.message}
            </ToolCallDetailText>
          )}

          {textResult && (
            <ToolCallDetailCode
              label="Result"
              code={textResult}
              language="text"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {resultRefId && loadingRefIds[resultRefId] && (
            <ToolCallDetailText>Loading result...</ToolCallDetailText>
          )}

          {resultRefId && failedRefIds[resultRefId] && (
            <ToolCallDetailText tone="danger">
              Could not load result.
            </ToolCallDetailText>
          )}

          {loadedResultText && (
            <ToolCallDetailCode
              label="Result"
              code={loadedResultText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {(contentCount > 1 || imageCount > 0) && (
            <ToolCallDetailText>
              {contentCount} result part{contentCount === 1 ? "" : "s"}
              {imageCount > 0
                ? `, ${imageCount} image${imageCount === 1 ? "" : "s"}`
                : ""}
            </ToolCallDetailText>
          )}
          </ToolCallDetails>
        )}
      </ToolCallRow>
    </div>
  );
}

export const McpToolBlock = memo(McpToolBlockComponent);
