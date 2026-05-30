import { useEffect, useState } from "react";
import { z } from "zod";
import type {
  JsonValue,
  UnifiedContentRef,
  UnifiedItem,
} from "@farfield/unified-surface";
import { MarkdownText } from "./MarkdownText";

type AgentMessageItem = Extract<UnifiedItem, { type: "agentMessage" }>;
type ContentRefLoader = (ref: UnifiedContentRef) => Promise<JsonValue>;

const LoadedTextSchema = z.string();

interface AgentMessageBlockProps {
  item: AgentMessageItem;
  onLoadContentRef: ContentRefLoader;
}

export function AgentMessageBlock({
  item,
  onLoadContentRef,
}: AgentMessageBlockProps): React.JSX.Element | null {
  const [loadedRefId, setLoadedRefId] = useState<string | null>(null);
  const [loadedText, setLoadedText] = useState<string | null>(null);
  const [loadingRefId, setLoadingRefId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const ref = item.textRef;
    if (!ref || loadedRefId === ref.id || loadingRefId === ref.id) {
      return;
    }

    let cancelled = false;
    setLoadingRefId(ref.id);
    setLoadFailed(false);
    void onLoadContentRef(ref)
      .then((value) => {
        const text = LoadedTextSchema.parse(value);
        if (!cancelled) {
          setLoadedText(text);
          setLoadedRefId(ref.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRefId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.textRef, loadedRefId, loadingRefId, onLoadContentRef]);

  const displayText = loadedText ?? item.text;
  if (!displayText && loadingRefId === null) {
    return null;
  }

  return (
    <div aria-busy={loadingRefId !== null}>
      {displayText ? (
        <MarkdownText text={displayText} />
      ) : (
        <div className="space-y-2 py-1 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-11/12 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      )}
      {loadFailed && item.textRef && (
        <div className="mt-2 text-xs text-danger">
          Could not load full message.
        </div>
      )}
    </div>
  );
}
