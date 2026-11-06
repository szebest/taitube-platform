import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { CommentInbox } from './comment-inbox';
import { InboxFilter } from './inbox-filter';

export function CommentsPage() {
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/comments' });
  const { filter } = useSearch({ from: '/_authed/comments' });

  return (
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
      <CommentInbox filter={filter} />
    </div>
  );
}
