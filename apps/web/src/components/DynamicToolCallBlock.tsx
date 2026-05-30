import { memo, useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
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
  ToolCallDetailText,
  ToolCallDetails,
} from "./ToolCallDetails";
import { ToolCallRow } from "./ToolCallRow";

type DynamicToolItem = Extract<UnifiedItem, { type: "dynamicToolCall" }>;
type ContentRefLoader = (ref: UnifiedContentRef) => Promise<JsonValue>;

interface DynamicToolCallBlockProps {
  item: DynamicToolItem;
  className?: string;
  onLoadContentRef: ContentRefLoader;
}

function toolStatusText(status: DynamicToolItem["status"]) {
  if (status === "inProgress") {
    return <span className="reasoning-shimmer">running</span>;
  }

  if (status === "failed") {
    return <span className="text-danger/80">failed</span>;
  }

  return null;
}

function stringifyJson(value: JsonValue): string {
  return JSON.stringify(JsonValueSchema.parse(value), null, 2);
}

function DynamicToolCallBlockComponent({
  item,
  className,
  onLoadContentRef,
}: DynamicToolCallBlockProps) {
  const [expanded, setExpanded] = useState(item.status === "inProgress");
  const [loadedArgumentsText, setLoadedArgumentsText] = useState<string | null>(
    null,
  );
  const [loadedContentItemsText, setLoadedContentItemsText] = useState<
    string | null
  >(null);
  const [loadingRefIds, setLoadingRefIds] = useState<Record<string, boolean>>(
    {},
  );
  const [failedRefIds, setFailedRefIds] = useState<Record<string, boolean>>({});
  const lastStatusRef = useRef(item.status);

  useEffect(() => {
    if (lastStatusRef.current === "inProgress" && item.status !== "inProgress") {
      setExpanded(true);
    }
    lastStatusRef.current = item.status;
  }, [item.status]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const refs: UnifiedContentRef[] = [];
    if (item.argumentsRef !== undefined) {
      refs.push(item.argumentsRef);
    }
    if (item.contentItemsRef !== undefined) {
      refs.push(item.contentItemsRef);
    }

    for (const ref of refs) {
      const alreadyLoaded =
        (item.argumentsRef !== undefined &&
          ref.id === item.argumentsRef.id &&
          loadedArgumentsText !== null) ||
        (item.contentItemsRef !== undefined &&
          ref.id === item.contentItemsRef.id &&
          loadedContentItemsText !== null);
      if (alreadyLoaded || loadingRefIds[ref.id]) {
        continue;
      }

      setLoadingRefIds((current) => ({ ...current, [ref.id]: true }));
      setFailedRefIds((current) => ({ ...current, [ref.id]: false }));
      void onLoadContentRef(ref)
        .then((value) => {
          const text = stringifyJson(JsonValueSchema.parse(value));
          if (item.argumentsRef !== undefined && ref.id === item.argumentsRef.id) {
            setLoadedArgumentsText(text);
          }
          if (
            item.contentItemsRef !== undefined &&
            ref.id === item.contentItemsRef.id
          ) {
            setLoadedContentItemsText(text);
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
    item.contentItemsRef,
    loadedArgumentsText,
    loadedContentItemsText,
    loadingRefIds,
    onLoadContentRef,
  ]);

  const argumentsText =
    item.argumentsRef === undefined ? stringifyJson(item.arguments) : null;
  const contentItemsText =
    item.contentItems !== undefined && item.contentItems !== null
      ? stringifyJson(JsonValueSchema.parse(item.contentItems))
      : null;
  const argumentsRefId = item.argumentsRef?.id ?? null;
  const contentItemsRefId = item.contentItemsRef?.id ?? null;
  const statusText = toolStatusText(item.status);
  const rows =
    item.success !== undefined && item.success !== null
      ? [{ label: "Success", value: item.success ? "yes" : "no" }]
      : [];
  const hasDetails =
    rows.length > 0 ||
    argumentsText !== null ||
    contentItemsText !== null ||
    argumentsRefId !== null ||
    contentItemsRefId !== null;

  return (
    <ToolCallRow
      icon={Wrench}
      iconClassName="text-amber-400"
      title={item.tool}
      {...(className !== undefined ? { className } : {})}
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      meta={
        <span className="flex items-center gap-1.5">
          {statusText}
          {item.durationMs != null && (
            <span>{formatDurationSeconds(item.durationMs)}</span>
          )}
        </span>
      }
    >
      {hasDetails && (
        <ToolCallDetails>
          <ToolCallDetailRows rows={rows} />

          {argumentsText !== null && (
            <ToolCallDetailCode
              label="Arguments"
              code={argumentsText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {argumentsRefId !== null && loadingRefIds[argumentsRefId] && (
            <ToolCallDetailText>Loading arguments...</ToolCallDetailText>
          )}

          {argumentsRefId !== null && failedRefIds[argumentsRefId] && (
            <ToolCallDetailText tone="danger">
              Could not load arguments.
            </ToolCallDetailText>
          )}

          {loadedArgumentsText !== null && (
            <ToolCallDetailCode
              label="Arguments"
              code={loadedArgumentsText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {contentItemsText !== null && (
            <ToolCallDetailCode
              label="Output"
              code={contentItemsText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}

          {contentItemsRefId !== null && loadingRefIds[contentItemsRefId] && (
            <ToolCallDetailText>Loading output...</ToolCallDetailText>
          )}

          {contentItemsRefId !== null && failedRefIds[contentItemsRefId] && (
            <ToolCallDetailText tone="danger">
              Could not load output.
            </ToolCallDetailText>
          )}

          {loadedContentItemsText !== null && (
            <ToolCallDetailCode
              label="Output"
              code={loadedContentItemsText}
              language="json"
              className="max-h-56 overflow-y-auto"
            />
          )}
        </ToolCallDetails>
      )}
    </ToolCallRow>
  );
}

function areDynamicToolCallBlockPropsEqual(
  prev: DynamicToolCallBlockProps,
  next: DynamicToolCallBlockProps,
): boolean {
  return (
    prev.item === next.item &&
    prev.className === next.className &&
    prev.onLoadContentRef === next.onLoadContentRef
  );
}

export const DynamicToolCallBlock = memo(
  DynamicToolCallBlockComponent,
  areDynamicToolCallBlockPropsEqual,
);
