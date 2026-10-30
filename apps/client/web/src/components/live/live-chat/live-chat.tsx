import { EmptyState } from '@vp/components';
import { Icon, Slot, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, type CSSProperties, useRef, useState } from 'react';
import { LiveChatContext, useLiveChat } from './live-chat.context';
import { liveChatStyles } from './live-chat.variants';
import { DEFAULT_OPACITY } from './live-chat-menu';
import { prefersReducedMotion, scrollToEnd } from './live-chat-scroll';
import type { LiveChatLayout } from './types';

export interface LiveChatRootProps extends ComponentPropsWithRef<'section'> {
  layout?: LiveChatLayout;
  onSend: (text: string) => void;
  /** Called when the viewer scrolls to the oldest message shown, to load the ones before it. */
  onEndReached?: () => void;
  /** The overlay's starting ground opacity, 30 to 100; the viewer moves it with `LiveChat.Opacity`. */
  defaultOpacity?: number;
}

/** The chat beside a live stream, or over it: a log that follows the newest message, and a composer. */
export function LiveChatRoot({
  layout = 'docked',
  onSend,
  onEndReached,
  defaultOpacity = DEFAULT_OPACITY,
  className,
  style,
  ...props
}: LiveChatRootProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [announce, setAnnounce] = useState(false);
  const [opacity, setOpacity] = useState(defaultOpacity);
  const { liveChat } = useUiCopy();

  const jumpToLatest = () => {
    const list = listRef.current;
    if (list) {
      scrollToEnd(list, prefersReducedMotion() ? 'auto' : 'smooth');
    }
    setFollowing(true);
    setUnseen(0);
  };

  const overlayStyle =
    layout === 'overlay' ? ({ '--chat-opacity': `${opacity}%` } as CSSProperties) : undefined;

  return (
    <LiveChatContext
      value={{
        layout,
        following,
        setFollowing,
        jumpToLatest,
        unseen,
        setUnseen,
        announce,
        setAnnounce,
        opacity,
        setOpacity,
        listRef,
        onSend,
        onEndReached,
      }}
    >
      <section
        data-slot="live-chat"
        data-layout={layout}
        aria-label={liveChat}
        className={liveChatStyles({ layout }).root({ className })}
        style={{ ...overlayStyle, ...style }}
        {...props}
      />
    </LiveChatContext>
  );
}

export interface LiveChatPartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The chat's name and the viewer count, with the options menu as a child. */
export function LiveChatHeader({
  asChild = false,
  className,
  children,
  ...props
}: LiveChatPartProps) {
  const { layout } = useLiveChat('Header');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="live-chat-header"
      className={liveChatStyles({ layout }).header({ className })}
      {...props}
    >
      {children}
    </Element>
  );
}

/** The message the creator or a moderator pinned, above the log. */
export function LiveChatPinned({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = useLiveChat('Pinned');
  const styles = liveChatStyles({ layout });

  return (
    <div data-slot="live-chat-pinned" className={styles.pinned({ className })} {...props}>
      <Icon name="pin" size="sm" className={styles.pinnedIcon()} />
      <div className="tw:min-w-0 tw:flex-1">{children}</div>
    </div>
  );
}

/** In place of the composer once the stream ends or the creator turns chat off. */
export function LiveChatEnded({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = useLiveChat('Ended');
  const { chatEnded } = useUiCopy();

  return (
    <div
      data-slot="live-chat-ended"
      className={liveChatStyles({ layout }).ended({ className })}
      {...props}
    >
      <EmptyState.Root size="inline">
        <EmptyState.Title>{children ?? chatEnded}</EmptyState.Title>
      </EmptyState.Root>
    </div>
  );
}
