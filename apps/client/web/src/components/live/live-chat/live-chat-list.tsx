import { Badge, Button, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
} from 'react';

import { useLiveChat } from './live-chat.context';
import { scrollToEnd } from './live-chat-scroll';
import { liveChatStyles } from './live-chat.variants';

const FOLLOW_SLOP_PX = 16;

type ScrollMemory = { top: number; pinned: boolean };

function pinToEnd(list: HTMLElement, memory: RefObject<ScrollMemory>) {
  scrollToEnd(list, 'auto');
  memory.current = { top: list.scrollTop, pinned: true };
}

/** The log, newest at the bottom: it follows new messages until the viewer scrolls up. */
export function LiveChatList({ className, children, ...props }: ComponentPropsWithRef<'ol'>) {
  const {
    layout,
    following,
    setFollowing,
    unseen,
    setUnseen,
    announce,
    jumpToLatest,
    listRef,
    onEndReached,
  } = useLiveChat('List');
  const { liveChat, jumpToLatest: jumpLabel } = useUiCopy();
  const styles = liveChatStyles({ layout });
  const memory = useRef<ScrollMemory>({ top: 0, pinned: true });

  const handleResized = useEffectEvent(() => {
    const list = listRef.current;
    if (list && memory.current.pinned) {
      pinToEnd(list, memory);
    }
  });

  const handleAdded = useEffectEvent((appended: number) => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    if (memory.current.pinned) {
      pinToEnd(list, memory);
      return;
    }
    if (appended > 0) {
      setUnseen(unseen + appended);
    }
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    pinToEnd(list, memory);
    const observer = new MutationObserver((records) => {
      const appended = records.reduce(
        (count, record) =>
          record.target === list.firstElementChild && record.nextSibling === null
            ? count + record.addedNodes.length
            : count,
        0
      );
      handleAdded(appended);
    });
    observer.observe(list, { childList: true, subtree: true });
    const resizes = new ResizeObserver(handleResized);
    if (list.firstElementChild) {
      resizes.observe(list.firstElementChild);
    }
    return () => {
      observer.disconnect();
      resizes.disconnect();
    };
  }, [listRef]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const scrolledUp = list.scrollTop < memory.current.top;
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight <= FOLLOW_SLOP_PX;
    memory.current = {
      top: list.scrollTop,
      pinned: atEnd || (memory.current.pinned && !scrolledUp),
    };
    if (atEnd) {
      setFollowing(true);
      setUnseen(0);
    } else if (scrolledUp) {
      setFollowing(false);
    }
    if (list.scrollTop <= FOLLOW_SLOP_PX) {
      onEndReached?.();
    }
  };

  return (
    <div className={styles.listWrap()}>
      <div
        ref={listRef}
        role="log"
        aria-live={announce ? 'polite' : 'off'}
        aria-label={liveChat}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the log scrolls, so the keyboard needs to reach it
        tabIndex={0}
        data-slot="live-chat-list"
        data-following={following}
        className={styles.list()}
        onScroll={handleScroll}
      >
        <ol className={styles.messages({ className })} {...props}>
          {children}
        </ol>
      </div>
      {!following && (
        <Button
          size="sm"
          tone="accent"
          variant="solid"
          className={styles.jump()}
          onClick={jumpToLatest}
        >
          {jumpLabel}
          {unseen > 0 && (
            <Badge size="sm" variant="soft" tone="neutral">
              {unseen}
            </Badge>
          )}
        </Button>
      )}
    </div>
  );
}
