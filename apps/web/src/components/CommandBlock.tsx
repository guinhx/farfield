import React, { memo, useState } from "react";
import {
  Terminal,
  Search,
  FolderOpen,
  FileText,
  FileSearch,
} from "lucide-react";
import { z } from "zod";
import type {
  JsonValue,
  UnifiedContentRef,
  UnifiedItem,
} from "@farfield/unified-surface";
import { summarizeCommandForHeader } from "@/lib/command-action-ui";
import { formatDurationSeconds } from "@/lib/tool-call-ui";
import {
  ToolCallDetailCode,
  ToolCallDetails,
  ToolCallDetailText,
} from "./ToolCallDetails";
import { ToolCallRow } from "./ToolCallRow";

type CommandItem = Extract<UnifiedItem, { type: "commandExecution" }>;
type ContentRefLoader = (ref: UnifiedContentRef) => Promise<JsonValue>;
const LoadedTextSchema = z.string();

const ACTION_ICONS: Record<string, React.ElementType> = {
  search: Search,
  listFiles: FolderOpen,
  write: FileText,
  read: FileSearch,
  readFile: FileSearch,
  writeFile: FileText,
};

interface CommandBlockProps {
  item: CommandItem;
  isActive: boolean;
  onLoadContentRef: ContentRefLoader;
}

function CommandBlockComponent({
  item,
  isActive,
  onLoadContentRef,
}: CommandBlockProps) {
  const [expanded, setExpanded] = useState(item.status === "inProgress");
  const [loadedOutput, setLoadedOutput] = useState<string | null>(null);
  const [isLoadingOutput, setIsLoadingOutput] = useState(false);
  const [outputLoadFailed, setOutputLoadFailed] = useState(false);
  const lastStatusRef = React.useRef(item.status);

  React.useEffect(() => {
    if (item.status === "completed" && lastStatusRef.current === "inProgress") {
      setExpanded(false);
    }
    lastStatusRef.current = item.status;
  }, [item.status]);

  React.useEffect(() => {
    const ref = item.aggregatedOutputRef;
    if (!expanded || !ref || loadedOutput !== null || isLoadingOutput) {
      return;
    }

    setIsLoadingOutput(true);
    setOutputLoadFailed(false);
    void onLoadContentRef(ref)
      .then((value) => {
        setLoadedOutput(LoadedTextSchema.parse(value));
      })
      .catch(() => {
        setOutputLoadFailed(true);
      })
      .finally(() => {
        setIsLoadingOutput(false);
      });
  }, [
    expanded,
    isLoadingOutput,
    item.aggregatedOutputRef,
    loadedOutput,
    onLoadContentRef,
  ]);

  const isCompleted = item.status === "completed";
  const isSuccess = item.exitCode === 0 || item.exitCode == null;
  const output = loadedOutput ?? item.aggregatedOutput ?? "";
  const hasOutput = output.trim().length > 0 || item.aggregatedOutputRef !== undefined;
  const headerSegments = summarizeCommandForHeader(item.command, item.commandActions);
  const displayedHeaderSegments = headerSegments.slice(0, 3);
  const hiddenHeaderSegmentsCount = Math.max(headerSegments.length - 3, 0);
  const statusText = isActive ? "running" : isCompleted && !isSuccess ? "failed" : null;
  const firstSegment = displayedHeaderSegments[0];
  const FirstSegmentIcon =
    firstSegment === undefined ? Terminal : ACTION_ICONS[firstSegment.iconKey] ?? Terminal;
  const titleIsRawCommand =
    firstSegment === undefined || firstSegment.iconKey === "unknown";

  return (
    <div className="text-sm">
      <ToolCallRow
        icon={FirstSegmentIcon}
        iconClassName="text-muted-foreground/65"
        title={
          titleIsRawCommand && firstSegment !== undefined ? (
            <code title={firstSegment.tooltip ?? firstSegment.text}>
              {firstSegment.text}
            </code>
          ) : firstSegment === undefined ? (
            <code>{item.command}</code>
          ) : (
            <span title={firstSegment.tooltip ?? firstSegment.text}>
              {firstSegment.text}
            </span>
          )
        }
        titleClassName={titleIsRawCommand ? "font-mono" : ""}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        meta={
          <>
            {statusText && (
              <span className={isActive ? "reasoning-shimmer" : "text-danger/80"}>
                {statusText}
              </span>
            )}
            {item.durationMs != null && (
              <span>{formatDurationSeconds(item.durationMs)}</span>
            )}
          </>
        }
      >
        {hiddenHeaderSegmentsCount > 0 && (
          <div className="text-[10px] leading-4 text-muted-foreground/70">
            +{hiddenHeaderSegmentsCount} more segment
            {hiddenHeaderSegmentsCount === 1 ? "" : "s"}
          </div>
        )}
        <ToolCallDetails>
          <ToolCallDetailCode
            label="Command"
            code={item.command}
            language="bash"
          />
          {isLoadingOutput ? (
            <ToolCallDetailText>Loading output...</ToolCallDetailText>
          ) : outputLoadFailed ? (
            <ToolCallDetailText tone="danger">
              Could not load output.
            </ToolCallDetailText>
          ) : hasOutput ? (
            <ToolCallDetailCode
              label="Output"
              code={output}
              language="bash"
              className="max-h-56 overflow-y-auto"
            />
          ) : (
            <ToolCallDetailText>No output</ToolCallDetailText>
          )}
        </ToolCallDetails>
      </ToolCallRow>
    </div>
  );
}

function areCommandBlockPropsEqual(
  prev: CommandBlockProps,
  next: CommandBlockProps,
): boolean {
  return prev.item === next.item && prev.isActive === next.isActive;
}

export const CommandBlock = memo(
  CommandBlockComponent,
  areCommandBlockPropsEqual,
);
