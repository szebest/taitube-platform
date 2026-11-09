import { useT } from '@vp/intl-react';
import { type LiveChatLine, useLiveChat } from '@vp/queries';
import { ChatCard } from '#app/components/live/chat-card';
import { API_PUBLIC_URL } from '#app/lib/config';

const VISIBLE_LINES = 15;

export interface OverlayChatProps {
  liveStreamId: string;
}

function authorOf(line: LiveChatLine, anonymous: string): string {
  return line.author?.displayName ?? line.author?.handle ?? anonymous;
}

/** The latest lines of the chat as cards, read-only, for an OBS browser source. */
export function OverlayChat({ liveStreamId }: OverlayChatProps) {
  const { tOr } = useT();
  const chat = useLiveChat({ liveStreamId, apiUrl: API_PUBLIC_URL });
  const anonymous = tOr('studio.liveChatViewer', {}, '');
  const shown = chat.lines.filter(({ state }) => state === 'sent').slice(-VISIBLE_LINES);

  return (
    <div
      role="log"
      aria-label={tOr('studio.liveOverlayChatLabel', {}, '')}
      className="flex max-w-[28rem] flex-col justify-end gap-inline"
    >
      {shown.map((line) => (
        <ChatCard.Root key={line.key}>
          <ChatCard.Author>{authorOf(line, anonymous)}</ChatCard.Author>
          <ChatCard.Text>{line.text}</ChatCard.Text>
        </ChatCard.Root>
      ))}
    </div>
  );
}
