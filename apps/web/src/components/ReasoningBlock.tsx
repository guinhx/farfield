import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { z } from "zod";
import type {
  JsonValue,
  UnifiedContentRef,
} from "@farfield/unified-surface";
import { Button } from "@/components/ui/button";

type ContentRefLoader = (ref: UnifiedContentRef) => Promise<JsonValue>;
const LoadedTextSchema = z.string();

interface ReasoningBlockProps {
  summary: string[];
  text?: string | undefined;
  textRef?: UnifiedContentRef | undefined;
  isActive: boolean;
  onLoadContentRef: ContentRefLoader;
}

export function ReasoningBlock({
  summary,
  text,
  textRef,
  isActive,
  onLoadContentRef,
}: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [loadedText, setLoadedText] = useState<string | null>(null);
  const [loadedRefId, setLoadedRefId] = useState<string | null>(null);
  const [loadingRefId, setLoadingRefId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const sanitizedSummary = summary.map((line) =>
    line.replaceAll("**", "").trim(),
  );
  const currentLine =
    sanitizedSummary[sanitizedSummary.length - 1] ?? "Thinking…";
  const canExpand =
    sanitizedSummary.length > 1 || text !== undefined || textRef !== undefined;
  const displayText = loadedText ?? text;

  useEffect(() => {
    if (!expanded || !textRef) {
      return;
    }

    if (loadedRefId === textRef.id || loadingRefId === textRef.id) {
      return;
    }

    let cancelled = false;
    setLoadingRefId(textRef.id);
    setLoadFailed(false);
    void onLoadContentRef(textRef)
      .then((value) => {
        const parsedText = LoadedTextSchema.parse(value);
        if (!cancelled) {
          setLoadedText(parsedText);
          setLoadedRefId(textRef.id);
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
  }, [
    expanded,
    loadedRefId,
    loadingRefId,
    onLoadContentRef,
    textRef,
  ]);

  return (
    <div className="my-4">
      <Button
        type="button"
        onClick={() => {
          if (canExpand) setExpanded((v) => !v);
        }}
        variant="ghost"
        className="h-auto w-full justify-start gap-2 p-0 text-left text-sm text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentLine}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.12 }}
            className={`text-sm truncate font-semibold ${isActive ? "reasoning-shimmer" : ""}`}
          >
            {currentLine}
          </motion.span>
        </AnimatePresence>

        {!isActive && sanitizedSummary.length > 1 && (
          <span className="text-xs text-muted-foreground/50 shrink-0">
            {sanitizedSummary.length} steps
          </span>
        )}

        {isActive ? (
          <Loader2
            size={12}
            className="ml-auto animate-spin shrink-0 opacity-60"
          />
        ) : canExpand ? (
          <ChevronRight
            size={12}
            className={`ml-auto shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          />
        ) : null}
      </Button>

      <AnimatePresence initial={false}>
        {canExpand && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-5 space-y-1 border-l border-border pl-3">
              {sanitizedSummary.map((line, i) => (
                <p
                  key={i}
                  className="text-xs font-semibold text-muted-foreground leading-5"
                >
                  {line}
                </p>
              ))}
              {loadingRefId !== null && (
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                  Loading reasoning...
                </div>
              )}
              {loadFailed && (
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-danger">
                  Could not load reasoning.
                </div>
              )}
              {displayText && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <pre className="text-[11px] text-muted-foreground/60 font-mono leading-5 whitespace-pre-wrap break-words">
                    {displayText}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
