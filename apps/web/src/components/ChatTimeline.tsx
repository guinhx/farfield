import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import type { UnifiedItem } from "@farfield/unified-surface";
import { ConversationItem } from "@/components/ConversationItem";
import { Button } from "@/components/ui/button";

export interface ChatTimelineEntry {
  key: string;
  item: UnifiedItem;
  isLast: boolean;
  turnIsInProgress: boolean;
  previousItemType: UnifiedItem["type"] | undefined;
  nextItemType: UnifiedItem["type"] | undefined;
  spacingTop: number;
}

interface ChatTimelineProps {
  selectedThreadId: string | null;
  isLoading: boolean;
  turnsLength: number;
  hasAnyAgent: boolean;
  hasHiddenChatItems: boolean;
  visibleConversationItems: ChatTimelineEntry[];
  isChatAtBottom: boolean;
  onSelectThread: (threadId: string) => void;
  onShowOlder: () => void;
  onScrollToBottom: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  chatContentRef: React.RefObject<HTMLDivElement | null>;
}

function ChatThreadSkeleton(): React.JSX.Element {
  return (
    <div data-testid="thread-loading-skeleton" className="space-y-5 py-2 animate-pulse">
      <div className="ml-auto w-[82%] space-y-2">
        <div className="h-4 w-24 rounded bg-muted/70" />
        <div className="rounded-lg border border-border/70 bg-muted/35 p-3 space-y-2">
          <div className="h-3.5 w-full rounded bg-muted" />
          <div className="h-3.5 w-4/5 rounded bg-muted" />
        </div>
      </div>
      <div className="w-full space-y-3">
        <div className="h-4 w-28 rounded bg-muted/70" />
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-muted" />
          <div className="h-3.5 w-[92%] rounded bg-muted" />
          <div className="h-3.5 w-[74%] rounded bg-muted" />
        </div>
        <div className="rounded-md border border-border/70 bg-muted/25 p-3 space-y-2">
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted/80" />
          <div className="h-3 w-2/3 rounded bg-muted/80" />
        </div>
      </div>
      <div className="w-full space-y-2">
        <div className="h-4 w-32 rounded bg-muted/70" />
        <div className="h-3.5 w-full rounded bg-muted" />
        <div className="h-3.5 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export const ChatTimeline = memo(function ChatTimeline({
  selectedThreadId,
  isLoading,
  turnsLength,
  hasAnyAgent,
  hasHiddenChatItems,
  visibleConversationItems,
  isChatAtBottom,
  onSelectThread,
  onShowOlder,
  onScrollToBottom,
  scrollRef,
  chatContentRef,
}: ChatTimelineProps): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-4 z-10 h-10 bg-gradient-to-b from-background from-20% via-background/60 via-60% to-transparent to-100%"
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ overflowAnchor: "none" }}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={selectedThreadId ?? "__no_thread__"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="max-w-3xl mx-auto px-4 pt-4 pb-6"
          >
            {turnsLength === 0 ? (
              isLoading ? (
                <ChatThreadSkeleton />
              ) : (
                <div className="text-center py-20 text-sm text-muted-foreground">
                  {selectedThreadId
                    ? "No messages yet"
                    : hasAnyAgent
                      ? "Start typing to create a new thread"
                      : "Select a thread from the sidebar"}
                </div>
              )
            ) : (
              <motion.div
                ref={chatContentRef}
                className="space-y-0"
                layout="position"
                style={{ overflowAnchor: "none" }}
              >
                {hasHiddenChatItems && (
                  <div className="flex justify-center pb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={onShowOlder}
                    >
                      Show older messages
                    </Button>
                  </div>
                )}
                {visibleConversationItems.map((entry) => (
                  <motion.div
                    key={entry.key}
                    layout="position"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ paddingTop: `${entry.spacingTop}px` }}
                  >
                    <ConversationItem
                      item={entry.item}
                      isLast={entry.isLast}
                      turnIsInProgress={entry.turnIsInProgress}
                      onSelectThread={onSelectThread}
                      previousItemType={entry.previousItemType}
                      nextItemType={entry.nextItemType}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {!isChatAtBottom && turnsLength > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+7.25rem)] md:bottom-[7.75rem] z-20"
          >
            <Button
              type="button"
              onClick={onScrollToBottom}
              size="icon"
              className="h-9 w-9 rounded-full border border-white/10 bg-background/75 text-foreground/80 shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-md hover:border-white/20 hover:bg-muted/80 hover:text-foreground"
            >
              <ArrowDown size={15} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
