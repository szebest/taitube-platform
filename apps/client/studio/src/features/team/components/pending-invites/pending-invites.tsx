import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { ChannelInviteView } from '@vp/api-contracts';
import { Format, useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { Icon, IconButton, useToast } from '@vp/ui';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { RoleBadge } from '#app/components/team/role-badge';
import { useRoleRules } from '#app/features/team/hooks/use-role-rules';
import { useRevokeInvite } from '#app/features/team/hooks/use-team-mutations';

const column = createColumnHelper<DataTableFeatures, ChannelInviteView>();
const NONE: readonly ChannelInviteView[] = [];

export interface PendingInvitesProps {
  invites: readonly ChannelInviteView[] | undefined;
}

/** The invites nobody has answered yet, each with its expiry and a way to take it back; absent while there are none. */
export function PendingInvites({ invites = NONE }: PendingInvitesProps) {
  const { tOr } = useT();
  const toast = useToast();
  const { canRevoke } = useRoleRules();
  const revoke = useRevokeInvite();
  const nameOf = (invite: ChannelInviteView) =>
    invite.invitee?.displayName ?? tOr('studio.teamUnknownMember', {}, '');

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.display({
        id: 'invitee',
        header: tOr('studio.teamColumnMember', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-col">
            <span className="text-label">{nameOf(original)}</span>
            {original.invitee && (
              <span className="text-caption text-fg-muted">@{original.invitee.handle}</span>
            )}
          </span>
        ),
      }),
      column.accessor('role', {
        header: tOr('studio.teamColumnRole', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row: { original } }) => (
          <RoleBadge channelRole={original.role}>
            {tOr('studio.teamRole', { role: original.role }, '')}
          </RoleBadge>
        ),
      }),
      column.accessor('expiresAt', {
        header: tOr('studio.teamInviteExpires', {}, ''),
        meta: { width: '10rem' },
        cell: ({ row: { original } }) => (
          <time dateTime={original.expiresAt}>
            <Format value={{ type: 'relative', value: original.expiresAt }} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.teamColumnActions', {}, ''),
        meta: { width: '6rem' },
        cell: ({ row: { original } }) =>
          canRevoke(original.role) && (
            <IconButton
              size="sm"
              aria-label={tOr('studio.teamInviteRevoke', { name: nameOf(original) }, '')}
              onClick={async () => {
                const revoked = await fromPromise(
                  () => revoke.mutateAsync(original.id),
                  (cause) => cause
                );
                toast(
                  isOk(revoked)
                    ? { tone: 'success', title: tOr('studio.teamInviteRevoked', {}, '') }
                    : { tone: 'danger', title: tOr('studio.teamInviteRevokeFailed', {}, '') }
                );
              }}
            >
              <Icon name="close" />
            </IconButton>
          ),
      }),
    ]),
    data: invites,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    enableSorting: false,
    manualPagination: true,
  });

  if (invites.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="team-invites-title" className="flex flex-col gap-stack">
      <h2 id="team-invites-title" className="m-0 text-title">
        {tOr('studio.teamInvitesTitle', {}, '')}
      </h2>
      <DataTable.Root table={table} state="ready">
        <DataTable.Caption>{tOr('studio.teamInvitesCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable.Root>
    </section>
  );
}
