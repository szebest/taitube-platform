import { EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';

import { LiveChat, type LiveChatLayout } from '#app/components/live/live-chat';
import { useChatReplay } from '../hooks/use-chat-replay';

interface LiveChatReplayProps {
  liveStreamId: string;
  layout: LiveChatLayout;
  /** Where the options menu opens: inside the player when it went fullscreen. */
  menuContainer?: HTMLElement;
}

/** A recording's chat: the lines posted up to where the player is, as they were posted live. */
export function LiveChatReplay({ liveStreamId, layout, menuContainer }: LiveChatReplayProps) {
  const { tOr } = useT();
  const lines = useChatReplay(liveStreamId);

  return (
    <LiveChat.Root layout={layout} onSend={() => undefined}>
      <LiveChat.Header>
        <h2 className="m-0 min-w-0 flex-1 truncate text-label">
          {tOr('live.replayTitle', {}, '')}
        </h2>
        <LiveChat.Menu container={menuContainer}>
          <LiveChat.Opacity />
        </LiveChat.Menu>
      </LiveChat.Header>
      {lines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-inset-card">
          <EmptyState.Root size="inline">
            <EmptyState.Description>{tOr('live.replayEmpty', {}, '')}</EmptyState.Description>
          </EmptyState.Root>
        </div>
      ) : (
        <LiveChat.List>
          {lines.map((line) => (
            <LiveChat.Message
              key={line.id}
              author={line.author.displayName ?? line.author.handle ?? ''}
              avatarSrc={line.author.avatarUrl ?? undefined}
            >
              {line.message}
            </LiveChat.Message>
          ))}
        </LiveChat.List>
      )}
    </LiveChat.Root>
  );
}
