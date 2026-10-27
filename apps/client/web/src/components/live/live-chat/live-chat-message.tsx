import { Avatar, Badge, Button, Icon, useUiCopy, VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

import { useLiveChat } from './live-chat.context';
import { liveChatStyles } from './live-chat.variants';
import type { LiveChatMessageState, LiveChatRole } from './types';

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
  const styles = liveChatStyles({ layout, state });
  const roleLabel = { viewer: undefined, creator: copy.roleCreator, moderator: copy.roleModerator }[
    role
  ];

  return (
    <li
      data-slot="live-chat-message"
      data-state={state}
      className={styles.message({ className })}
      {...props}
    >
      <Avatar.Root size="sm" aria-hidden="true" className="tw:shrink-0">
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback>{author.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className="tw:min-w-0 tw:flex-1">
        <p className={styles.messageBody()}>
          {roleLabel && (
            <Badge size="sm" variant="soft" tone="accent" className={styles.roleBadge()}>
              {roleLabel}
            </Badge>
          )}
          <span className={styles.author()}>{author}</span>
          <span className={styles.text()}>
            {state === 'removed' ? copy.messageRemoved : children}
          </span>
          {state === 'pending' && <VisuallyHidden>{copy.messagePending}</VisuallyHidden>}
        </p>
        {state === 'failed' && (
          <div className={styles.failure()}>
            <Icon name="alert" size="sm" />
            <span>{copy.messageFailed}</span>
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
