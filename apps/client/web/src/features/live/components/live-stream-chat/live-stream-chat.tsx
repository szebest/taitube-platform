import { Link, useLocation } from '@tanstack/react-router';
import type { LiveStreamPublicView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { ERROR_COPY } from '@vp/messages';
import { type LiveChatLine, useAccount, useLiveChat } from '@vp/queries';
import { Button } from '@vp/ui';
import { CHAT_MESSAGE_BOUNDS } from '@vp/validation';
import { LiveChat, type LiveChatLayout } from '#app/components/live/live-chat';
import { API_PUBLIC_URL } from '#app/lib/config';

interface LiveStreamChatProps {
  stream: Pick<LiveStreamPublicView, 'id' | 'status'>;
  layout: LiveChatLayout;
  /** Where the options menu opens: inside the player when it went fullscreen. */
  menuContainer?: HTMLElement;
}

/** The chat of a broadcast that is live: the lines over its socket, and the composer for a signed-in viewer. */
export function LiveStreamChat({ stream, layout, menuContainer }: LiveStreamChatProps) {
  const href = useLocation({ select: (location) => location.href });
  const { tOr } = useT();
  const guest = useAccount() === undefined;
  const chat = useLiveChat({
    liveStreamId: stream.id,
    apiUrl: API_PUBLIC_URL,
    enabled: stream.status === 'LIVE',
  });

  const authorOf = (line: LiveChatLine) =>
    line.author?.displayName ?? line.author?.handle ?? tOr('live.you', {}, '');
  const refusal = () => {
    if (chat.refusal === ErrorCodes.LIVE_CHAT_SLOW_MODE && chat.mode) {
      return tOr('live.chatSlowMode', { seconds: chat.mode.slowModeSeconds }, '');
    }
    return chat.refusal && tOr(ERROR_COPY[chat.refusal], {}, '');
  };
  const notice = () => {
    if (chat.connection === 'closed') {
      return tOr('live.chatReconnecting', {}, '');
    }
    if (chat.connection === 'open' && !(guest || chat.canSend)) {
      return tOr('live.chatUnavailable', {}, '');
    }
    return refusal();
  };

  return (
    <LiveChat.Root layout={layout} onSend={chat.send}>
      <LiveChat.Header>
        <h2 className="m-0 min-w-0 flex-1 truncate text-label">{tOr('live.chatTitle', {}, '')}</h2>
        <LiveChat.Menu container={menuContainer}>
          <LiveChat.Opacity />
        </LiveChat.Menu>
      </LiveChat.Header>
      {chat.mode?.subscribersOnly && (
        <LiveChat.Pinned>{tOr('live.chatSubscribersOnly', {}, '')}</LiveChat.Pinned>
      )}
      <LiveChat.List>
        {chat.lines.map((line) => (
          <LiveChat.Message
            key={line.key}
            author={authorOf(line)}
            avatarSrc={line.author?.avatarUrl ?? undefined}
            state={line.state}
            onRetry={() => chat.retry(line)}
          >
            {line.text}
          </LiveChat.Message>
        ))}
      </LiveChat.List>
      <p role="status" className="m-0 px-inset-card text-caption empty:hidden">
        {notice()}
      </p>
      {guest ? (
        <LiveChat.Ended>
          <Button asChild variant="soft" tone="accent">
            <Link to="/login" search={{ redirect: href }}>
              {tOr('live.signInToChat', {}, '')}
            </Link>
          </Button>
        </LiveChat.Ended>
      ) : (
        <LiveChat.Composer
          maxLength={CHAT_MESSAGE_BOUNDS.maxLength}
          disabled={!(chat.canSend && chat.connection === 'open')}
        />
      )}
    </LiveChat.Root>
  );
}
