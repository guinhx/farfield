import React, { memo, useState } from "react";
import { FilePlus, FileMinus, FileEdit } from "lucide-react";
import { z } from "zod";
import type {
  JsonValue,
  UnifiedContentRef,
} from "@farfield/unified-surface";
import { languageFromPath } from "@/lib/code-language";
import { CodeSnippet } from "./CodeSnippet";
import { ToolCallRow } from "./ToolCallRow";

interface FileChange {
  path: string;
  kind: { type: string; movePath?: string | null | undefined };
  diff?: string | undefined;
  diffRef?: UnifiedContentRef | undefined;
}

interface DiffBlockProps {
  changes: FileChange[];
  onLoadContentRef?: (ref: UnifiedContentRef) => Promise<JsonValue>;
}
const LoadedTextSchema = z.string();

type LineType = "add" | "remove" | "header" | "context";
interface DiffLine {
  type: LineType;
  content: string;
}

function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("@@")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("+++")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("---")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1) });
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", content: line.slice(1) });
    } else {
      const content = line.startsWith(" ") ? line.slice(1) : line;
      if (content) result.push({ type: "context", content });
    }
  }
  return result;
}

function kindMeta(kind: string) {
  if (kind === "create")
    return { Icon: FilePlus, cls: "text-success" };
  if (kind === "delete")
    return { Icon: FileMinus, cls: "text-danger" };
  return {
    Icon: FileEdit,
    cls: "text-blue-400 dark:text-blue-400",
  };
}

const LINE_STYLES: Record<LineType, string> = {
  add: "bg-success/8 dark:bg-success/10",
  remove: "bg-danger/8 dark:bg-danger/10",
  header: "bg-muted/60",
  context: "",
};
const TEXT_STYLES: Record<LineType, string> = {
  add: "text-success dark:text-success/90",
  remove: "text-danger dark:text-danger/90",
  header: "text-muted-foreground/60 italic",
  context: "text-foreground/70",
};
const GUTTER_STYLES: Record<LineType, string> = {
  add: "text-success/50",
  remove: "text-danger/50",
  header: "text-muted-foreground/30",
  context: "text-muted-foreground/25",
};
const GUTTER_CHAR: Record<LineType, string> = {
  add: "+",
  remove: "−",
  header: "",
  context: " ",
};

function DiffBlockComponent({ changes, onLoadContentRef }: DiffBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(
    changes.length > 0 && changes[0]?.diff == null ? 0 : null,
  );
  const [loadedDiffs, setLoadedDiffs] = useState<Record<string, string>>({});
  const [loadingDiffRefId, setLoadingDiffRefId] = useState<string | null>(null);
  const [failedDiffRefId, setFailedDiffRefId] = useState<string | null>(null);
  const lastDiffLengthRef = React.useRef(changes[0]?.diff?.length ?? 0);

  React.useEffect(() => {
    if (changes.length > 0) {
      const currentDiffLength = changes[0]?.diff?.length ?? 0;
      const prevDiffLength = lastDiffLengthRef.current;

      if (currentDiffLength > 0 && prevDiffLength === 0) {
        setExpandedIdx(null);
      }
      lastDiffLengthRef.current = currentDiffLength;
    }
  }, [changes]);

  React.useEffect(() => {
    if (expandedIdx === null) {
      return;
    }

    const change = changes[expandedIdx];
    const ref = change?.diffRef;
    if (
      !ref ||
      !onLoadContentRef ||
      loadedDiffs[ref.id] !== undefined ||
      loadingDiffRefId === ref.id
    ) {
      return;
    }

    setLoadingDiffRefId(ref.id);
    setFailedDiffRefId(null);
    void onLoadContentRef(ref)
      .then((value) => {
        setLoadedDiffs((current) => ({
          ...current,
          [ref.id]: LoadedTextSchema.parse(value),
        }));
      })
      .catch(() => {
        setFailedDiffRefId(ref.id);
      })
      .finally(() => {
        setLoadingDiffRefId(null);
      });
  }, [
    changes,
    expandedIdx,
    loadedDiffs,
    loadingDiffRefId,
    onLoadContentRef,
  ]);

  return (
    <div className="text-sm">
      {changes.map((change, i) => {
        const isExpanded = expandedIdx === i;
        const fileName = change.path.split("/").pop() ?? change.path;
        const dirPath = change.path.slice(0, change.path.lastIndexOf("/"));
        const refId = change.diffRef?.id ?? null;
        const loadedDiff = refId ? loadedDiffs[refId] : undefined;
        const displayDiff = loadedDiff ?? change.diff;
        const lines = displayDiff ? parseDiff(displayDiff) : [];
        const previewLanguage = languageFromPath(change.path);
        const added = lines.filter((line) => line.type === "add").length;
        const removed = lines.filter((line) => line.type === "remove").length;
        const { Icon, cls } = kindMeta(change.kind.type);

        return (
          <div key={i} className={i > 0 ? "mt-0.5" : ""}>
            <ToolCallRow
              icon={Icon}
              iconClassName={cls}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{fileName}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {added > 0 && (
                      <span className="text-success">+{added}</span>
                    )}
                    {removed > 0 && (
                      <span className="text-danger">−{removed}</span>
                    )}
                  </span>
                  {dirPath && (
                    <span className="hidden truncate text-[11px] text-muted-foreground/40 sm:block">
                      {dirPath}
                    </span>
                  )}
                </span>
              }
              expanded={isExpanded}
              onToggle={() => setExpandedIdx(isExpanded ? null : i)}
            >
                  <div className="overflow-x-auto">
                    {loadingDiffRefId === refId ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Loading diff...
                      </div>
                    ) : failedDiffRefId === refId ? (
                      <div className="px-3 py-2 text-xs text-danger">
                        Could not load diff.
                      </div>
                    ) : displayDiff ? (
                      lines.map((line, j) => (
                        <div
                          key={j}
                          className={`flex font-mono text-xs leading-5 ${LINE_STYLES[line.type]}`}
                        >
                          <span
                            className={`select-none w-6 text-center text-[10px] shrink-0 pt-px ${GUTTER_STYLES[line.type]}`}
                          >
                            {GUTTER_CHAR[line.type]}
                          </span>
                          <span
                            className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${TEXT_STYLES[line.type]}`}
                          >
                            {line.type === "header" ? (
                              line.content
                            ) : (
                              <CodeSnippet
                                code={line.content}
                                language={previewLanguage}
                                wrapLongLines={false}
                                inline
                              />
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No diff available
                      </div>
                    )}
                  </div>
            </ToolCallRow>
          </div>
        );
      })}
    </div>
  );
}

function areDiffBlockPropsEqual(
  prev: DiffBlockProps,
  next: DiffBlockProps,
): boolean {
  return (
    prev.changes === next.changes &&
    prev.onLoadContentRef === next.onLoadContentRef
  );
}

export const DiffBlock = memo(DiffBlockComponent, areDiffBlockPropsEqual);
