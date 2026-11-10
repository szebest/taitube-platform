import { useSearch } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { EmptyState, PageHeader, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Skeleton } from '@vp/ui';
import { LoadMore } from '#app/components/table/load-more';
import { useMyInvites } from '#app/features/team/hooks/use-my-invites';
import { InviteCard } from '../invite-card/invite-card';

/** The invites to a team that wait for the viewer's answer. */
export function InvitesPage() {
  const { tOr } = useT();
  const { invite: opened } = useSearch({ from: '/_authed/invites' });
  const invites = useMyInvites();
  const rows = invites.data ?? [];
  const refused =
    invites.error instanceof ApiError &&
    (invites.error.status === 401 || invites.error.status === 403);

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.invitesTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>{tOr('studio.invitesDescription', {}, '')}</PageHeader.Description>
      </PageHeader.Root>
      {invites.isPending && <Skeleton className="h-32 w-full" />}
      {invites.isError && refused && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.invitesNoAccessTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.invitesNoAccessDescription', {}, '')}
          </EmptyState.Description>
        </EmptyState.Root>
      )}
      {invites.isError && !refused && rows.length === 0 && (
        <SectionError.Root onRetry={() => invites.refetch()} retrying={invites.isFetching}>
          <SectionError.Message>{tOr('studio.invitesFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {invites.isSuccess && rows.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.invitesEmptyTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.invitesEmptyDescription', {}, '')}
          </EmptyState.Description>
        </EmptyState.Root>
      )}
      {rows.length > 0 && (
        <ul
          aria-label={tOr('studio.invitesList', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {rows.map((invite) => (
            <InviteCard key={invite.id} invite={invite} opened={invite.id === opened} />
          ))}
        </ul>
      )}
      <LoadMore
        hasNextPage={invites.hasNextPage}
        fetching={invites.isFetchingNextPage}
        onLoadMore={() => void invites.fetchNextPage()}
      />
    </div>
  );
}
