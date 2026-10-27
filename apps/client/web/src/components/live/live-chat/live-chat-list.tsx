import { Badge, Button, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useEffect, useEffectEvent } from 'react';

import { useLiveChat } from './live-chat.context';
import { scrollToEnd } from './live-chat-scroll';
import { liveChatStyles } from './live-chat.variants';

const FOLLOW_SLOP_PX = 16;

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

  const handleAdded = useEffectEvent((added: number) => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    if (following) {
      scrollToEnd(list, 'auto');
      return;
    }
    setUnseen(unseen + added);
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    scrollToEnd(list, 'auto');
    const observer = new MutationObserver((records) => {
      const added = records.reduce((count, record) => count + record.addedNodes.length, 0);
      if (added > 0) {
        handleAdded(added);
      }
    });
    observer.observe(list, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [listRef]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight <= FOLLOW_SLOP_PX;
    setFollowing(atEnd);
    if (atEnd) {
      setUnseen(0);
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
