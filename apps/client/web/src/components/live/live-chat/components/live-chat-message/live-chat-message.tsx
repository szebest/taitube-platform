import { Avatar, Badge, Button, Icon, useUiCopy, VisuallyHidden } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { useLiveChat } from '#app/components/live/live-chat/live-chat.context';
import { liveChatStyles } from '#app/components/live/live-chat/live-chat.variants';
import type { LiveChatMessageState, LiveChatRole } from '#app/components/live/live-chat/types';
import { useT } from '#app/lib/messages';

export interface LiveChatMessageProps extends ComponentPropsWithRef<'li'> {
  author: string;
  avatarSrc?: string;
  role?: LiveChatRole;
  state?: LiveChatMessageState;
  /** Offered beside a message that failed to send. */
  onRetry?: () => void;
}

export function LiveChatMessage({
  author,
  avatarSrc,
  role = 'viewer',
  state = 'sent',
  onRetry,
  className,
  children,
  ...props
}: LiveChatMessageProps) {
  const { layout } = useLiveChat('Message');
  const copy = useUiCopy();
  const { tOr } = useT();
  const styles = liveChatStyles({ layout, state });
  const roleLabel = {
    viewer: undefined,
    creator: tOr('appUi.roleCreator', {}, ''),
    moderator: tOr('appUi.roleModerator', {}, ''),
  }[role];

  return (
    <li
      data-slot="live-chat-message"
      data-state={state}
      className={styles.message({ className })}
      {...props}
    >
      <Avatar.Root size="sm" aria-hidden="true" className="shrink-0">
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback>{author.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className="min-w-0 flex-1">
        <p className={styles.messageBody()}>
          {roleLabel && (
            <Badge size="sm" variant="soft" tone="accent" className={styles.roleBadge()}>
              {roleLabel}
            </Badge>
          )}
          <span className={styles.author()}>{author}</span>
          <span className={styles.text()}>
            {state === 'removed' ? tOr('appUi.messageRemoved', {}, '') : children}
          </span>
          {state === 'pending' && (
            <VisuallyHidden>{tOr('appUi.messagePending', {}, '')}</VisuallyHidden>
          )}
        </p>
        {state === 'failed' && (
          <div className={styles.failure()}>
            <Icon name="alert" size="sm" />
            <span>{tOr('appUi.messageFailed', {}, '')}</span>
            {onRetry && (
              <Button size="sm" variant="ghost" tone="danger" onClick={onRetry}>
                {copy.retry}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
