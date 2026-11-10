import { useT } from '@vp/intl-react';
import { Avatar, Button } from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { LiveChat } from '#app/components/live/live-chat';
import type { LiveChatRootProps } from '#app/components/live/live-chat/live-chat';
import { useLiveChat } from '#app/components/live/live-chat/live-chat.context';
import { liveChatStyles } from '#app/components/live/live-chat/live-chat.variants';
import type { PartyChatComposerState } from './types';

/** The Chat tab: the live chat's log and composer, named for the party. */
export type PartyChatRootProps = LiveChatRootProps;

export function PartyChatRoot(props: PartyChatRootProps) {
  const { tOr } = useT();

  return <LiveChat.Root aria-label={tOr('party.tabsChat', {}, '')} {...props} />;
}

export interface PartyChatLineProps extends ComponentPropsWithRef<'li'> {
  author: string;
  avatarUrl?: string | null;
  /** The author's role badges, in their colours. */
  badges?: ReactNode;
  /** A line the system wrote: no avatar, set apart from what people said. */
  system?: boolean;
  /** The viewer chose to hide this author; shown as a placeholder until `onShow`. */
  hidden?: boolean;
  onShow?: () => void;
}

export function PartyChatLine({
  author,
  avatarUrl,
  badges,
  system = false,
  hidden = false,
  onShow,
  className,
  children,
  ...props
}: PartyChatLineProps) {
  const { layout } = useLiveChat('Line');
  const { tOr } = useT();
  const styles = liveChatStyles({ layout });

  if (system) {
    return (
      <li
        data-slot="party-chat-line"
        data-system
        className={`text-caption text-fg-muted italic ${className ?? ''}`}
        {...props}
      >
        {children}
      </li>
    );
  }

  return (
    <li data-slot="party-chat-line" className={styles.message({ className })} {...props}>
      <Avatar.Root size="sm" aria-hidden="true" className="shrink-0">
        {avatarUrl && !hidden && <Avatar.Image src={avatarUrl} alt="" />}
        <Avatar.Fallback>{author.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className="min-w-0 flex-1">
        <p className={styles.messageBody()}>
          {badges}
          <span className={styles.author()}>{author}</span>
          {hidden ? (
            <span className="text-fg-muted italic">{tOr('party.chatHidden', {}, '')}</span>
          ) : (
            <span className={styles.text()}>{children}</span>
          )}
        </p>
        {hidden && onShow && (
          <Button size="sm" variant="ghost" onClick={onShow}>
            {tOr('party.chatShowAnyway', {}, '')}
          </Button>
        )}
      </div>
    </li>
  );
}

export interface PartyChatComposerProps {
  state: PartyChatComposerState;
  /** The local time a mute ends; without it a muted viewer is muted for the party. */
  mutedUntil?: string;
  maxLength?: number;
  /** Slow mode: the line shown while the composer waits. */
  wait?: string;
  /** A guest's persistent bar upgrades the seat in place. */
  onSignIn?: () => void;
}

/** The composer, or what takes its place: a mute with its end, chat off, offline, or a guest's sign-in bar. */
export function PartyChatComposer({
  state,
  mutedUntil,
  maxLength,
  wait,
  onSignIn,
}: PartyChatComposerProps) {
  const { layout } = useLiveChat('Composer');
  const { tOr } = useT();
  const styles = liveChatStyles({ layout });

  switch (state) {
    case 'open':
      return <LiveChat.Composer maxLength={maxLength} wait={wait} />;
    case 'guest':
      return (
        <div data-slot="party-chat-sign-in" className={styles.ended()}>
          <Button size="sm" tone="accent" variant="solid" onClick={onSignIn}>
            {tOr('party.chatSignInToChat', {}, '')}
          </Button>
        </div>
      );
    case 'muted':
      return (
        <LiveChat.Ended>
          {mutedUntil
            ? tOr('party.chatMutedUntil', { time: mutedUntil }, '')
            : tOr('party.chatMutedForParty', {}, '')}
        </LiveChat.Ended>
      );
    case 'off':
      return <LiveChat.Ended>{tOr('party.chatOff', {}, '')}</LiveChat.Ended>;
    case 'offline':
      return <LiveChat.Ended>{tOr('party.chatOffline', {}, '')}</LiveChat.Ended>;
  }
}
