import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import {
  type ModerationChannel,
  ModerationChannelProvider,
} from '#app/features/comments/hooks/use-moderation-channel';
import { CommentInbox } from '../comment-inbox/comment-inbox';
import { InboxFilter } from '../inbox-filter/inbox-filter';

export interface CommentsPageProps {
  channel: ModerationChannel;
}

export function CommentsPage({ channel }: CommentsPageProps) {
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/comments' });
  const { filter } = useSearch({ from: '/_authed/comments' });

  return (
    <ModerationChannelProvider channel={channel}>
      <div className="flex flex-col gap-section">
        <PageHeader.Root>
          <PageHeader.Title asChild>
            <h1>{tOr('studio.commentsTitle', {}, '')}</h1>
          </PageHeader.Title>
          <PageHeader.Actions>
            <InboxFilter
              value={filter}
              onChange={(next) => void navigate({ search: { filter: next } })}
            />
          </PageHeader.Actions>
        </PageHeader.Root>
        <CommentInbox key={filter} filter={filter} />
      </div>
    </ModerationChannelProvider>
  );
}
