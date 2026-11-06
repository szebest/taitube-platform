import type { LiveStreamView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { type LiveChatLine, useLiveChat } from '@vp/queries';
import { Card, Icon, IconButton } from '@vp/ui';

import { API_PUBLIC_URL } from '#app/config';

export interface LiveChatModerationProps {
  stream: LiveStreamView;
}

function keepInView(row: HTMLElement | null) {
  const log = row?.parentElement;
  if (log) {
    log.scrollTop = log.scrollHeight;
  }
}

function authorOf(line: LiveChatLine, anonymous: string): string {
  return line.author?.displayName ?? line.author?.handle ?? anonymous;
}

/** The broadcast's chat as its creator sees it, with a Remove for each line it may remove. */
export function LiveChatModeration({ stream }: LiveChatModerationProps) {
  const { tOr } = useT();
  const live = stream.status === 'LIVE';
  const chat = useLiveChat({ liveStreamId: stream.id, apiUrl: API_PUBLIC_URL, enabled: live });
  const anonymous = tOr('studio.liveChatViewer', {}, '');

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title asChild>
          <h2>{tOr('studio.liveChatTitle', {}, '')}</h2>
        </Card.Title>
        {live && chat.connection !== 'open' && (
          <Card.Description role="status">
            {tOr('studio.liveChatConnection', { connection: chat.connection }, '')}
          </Card.Description>
        )}
      </Card.Header>
      <Card.Body>
        <div
          role="log"
          aria-label={tOr('studio.liveChatTitle', {}, '')}
          className="tw:flex tw:max-h-[24rem] tw:min-h-[8rem] tw:flex-col tw:gap-inline tw:overflow-y-auto"
        >
          {chat.lines.length === 0 && (
            <p className="tw:m-0 tw:text-fg-muted">
              {live ? tOr('studio.liveChatEmpty', {}, '') : tOr('studio.liveChatOffline', {}, '')}
            </p>
          )}
          {chat.lines.map((line, index) => (
            <div
              key={line.key}
              ref={index === chat.lines.length - 1 ? keepInView : undefined}
              className="tw:flex tw:items-start tw:gap-inline"
            >
              {line.state === 'removed' ? (
                <p className="tw:m-0 tw:me-auto tw:text-fg-muted">
                  {tOr('studio.liveChatRemoved', {}, '')}
                </p>
              ) : (
                <p className="tw:m-0 tw:me-auto tw:break-words">
                  <strong>{authorOf(line, anonymous)}</strong> {line.text}
                </p>
              )}
              {chat.canModerate && line.state === 'sent' && line.id !== undefined && (
                <IconButton
                  size="sm"
                  aria-label={tOr(
                    'studio.liveChatRemove',
                    { author: authorOf(line, anonymous) },
                    ''
                  )}
                  onClick={() => chat.remove(line.id ?? '')}
                >
                  <Icon name="trash" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      </Card.Body>
    </Card.Root>
  );
}
