import { useQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { ChannelMemberView } from '@vp/api-contracts';
import { EmptyState, SectionError } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button, Icon, IconButton } from '@vp/ui';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { tableStateOf } from '#app/features/admin/api/paged-rows';
import { teamQueryOptions } from '#app/features/team/api/team-queries';
import { useRoleRules } from '#app/features/team/hooks/use-role-rules';
import { InviteDialog } from '../invite-dialog/invite-dialog';
import { MemberRoleCell } from '../member-role-cell/member-role-cell';
import { PendingInvites } from '../pending-invites/pending-invites';
import { RemoveMemberDialog } from '../remove-member-dialog/remove-member-dialog';

const column = createColumnHelper<DataTableFeatures, ChannelMemberView>();
const NONE: readonly ChannelMemberView[] = [];

/** The members of the acting channel with their roles, who invited whom still waiting below, and the way to invite. */
export function MembersPanel() {
  const { tOr } = useT();
  const team = useQuery(teamQueryOptions(useApi()));
  const { canInvite, canRemove } = useRoleRules();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<ChannelMemberView>();

  const rows = team.data?.members ?? NONE;
  const nameOf = (member: ChannelMemberView) =>
    member.profile?.displayName ?? tOr('studio.teamUnknownMember', {}, '');

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.display({
        id: 'member',
        header: tOr('studio.teamColumnMember', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-col">
            <span className="text-label">{nameOf(original)}</span>
            {original.profile && (
              <span className="text-caption text-fg-muted">@{original.profile.handle}</span>
            )}
          </span>
        ),
      }),
      column.display({
        id: 'role',
        header: tOr('studio.teamColumnRole', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row: { original } }) => (
          <MemberRoleCell member={original} name={nameOf(original)} />
        ),
      }),
      column.accessor('joinedAt', {
        header: tOr('studio.teamColumnJoined', {}, ''),
        meta: { width: '10rem' },
        cell: ({ row: { original } }) => (
          <time dateTime={original.joinedAt}>
            <Format value={publishedAt(original.joinedAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.teamColumnActions', {}, ''),
        meta: { width: '6rem' },
        cell: ({ row: { original } }) =>
          canRemove(original.userId, original.role) && (
            <IconButton
              size="sm"
              aria-label={tOr('studio.teamRemove', { name: nameOf(original) }, '')}
              onClick={() => setRemoving(original)}
            >
              <Icon name="trash" />
            </IconButton>
          ),
      }),
    ]),
    data: rows,
    getRowId: ({ userId }) => userId,
    enableRowSelection: false,
    enableSorting: false,
    manualPagination: true,
  });

  const state = tableStateOf(team, rows.length);
  const mayInvite = canInvite('editor');

  return (
    <div className="flex flex-col gap-section">
      <DataTable.Root table={table} state={state} fetching={team.isFetching && !team.isPending}>
        <DataTable.Caption>{tOr('studio.teamMembersCaption', {}, '')}</DataTable.Caption>
        {mayInvite && (
          <DataTable.Toolbar>
            <Button variant="solid" tone="accent" size="sm" onClick={() => setInviting(true)}>
              <Icon name="plus" />
              {tOr('studio.teamInvite', {}, '')}
            </Button>
          </DataTable.Toolbar>
        )}
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.teamEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.teamEmptyDescription', {}, '')}
              </EmptyState.Description>
              {mayInvite && (
                <EmptyState.Action onClick={() => setInviting(true)}>
                  {tOr('studio.teamInvite', {}, '')}
                </EmptyState.Action>
              )}
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => team.refetch()} retrying={team.isFetching}>
              <SectionError.Message>{tOr('studio.teamFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <PendingInvites invites={team.data?.invites} />
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {removing && (
        <RemoveMemberDialog
          member={removing}
          name={nameOf(removing)}
          onClose={() => setRemoving(undefined)}
        />
      )}
    </div>
  );
}
