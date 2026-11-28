import { SectionError } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Icon, IconButton, Select } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_COLLABORATOR_ROLES, type PlaylistCollaboratorRole } from '@vp/domain';
import { useApi } from '@vp/queries';
import {
  CollaboratorList,
  CollaboratorListSkeleton,
} from '#app/components/playlist/collaborator-list';
import { playlistCollaboratorsQueryOptions } from '#app/features/library/api/playlist-queries';
import { useCollaboratorChanges } from '#app/features/library/hooks/use-collaborator-changes';
import { useT } from '#app/lib/messages';

export interface CollaboratorRowsProps {
  playlist: PlaylistView;
  /** The owner's role select and remove button on each row. */
  manageable: boolean;
}

const isRole = (value: string): value is PlaylistCollaboratorRole =>
  PLAYLIST_COLLABORATOR_ROLES.some((role) => role === value);

/** The owner first, then each collaborator with their role and when they joined. */
export function CollaboratorRows({ playlist, manageable }: CollaboratorRowsProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const collaborators = useQuery(playlistCollaboratorsQueryOptions(useApi(), playlist.id));
  const { changeRole, remove } = useCollaboratorChanges(playlist.id);

  const someone = tOr('playlistPeople.someone', {}, '');
  const { owner } = playlist;

  if (collaborators.isPending) {
    return <CollaboratorListSkeleton />;
  }
  if (collaborators.isError) {
    return (
      <SectionError.Root
        role="alert"
        retrying={collaborators.isFetching}
        onRetry={() => void collaborators.refetch()}
      >
        <SectionError.Message>{tOr('playlistPeople.loadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }

  return (
    <CollaboratorList.Root aria-label={tOr('playlistPeople.peopleLabel', {}, '')}>
      <CollaboratorList.Item>
        <CollaboratorList.Avatar
          src={owner?.avatarUrl ?? undefined}
          name={owner?.displayName ?? someone}
        />
        <CollaboratorList.Name>{owner?.displayName ?? someone}</CollaboratorList.Name>
        <CollaboratorList.Meta>{tOr('playlistPeople.owner', {}, '')}</CollaboratorList.Meta>
      </CollaboratorList.Item>
      {collaborators.data.items.map(({ userId, role, channel, joinedAt }) => {
        const name = channel?.displayName ?? someone;
        const joined = unwrapOr(format({ type: 'relative', value: joinedAt }), '');
        return (
          <CollaboratorList.Item key={userId}>
            <CollaboratorList.Avatar src={channel?.avatarUrl ?? undefined} name={name} />
            <CollaboratorList.Name>{name}</CollaboratorList.Name>
            <CollaboratorList.Meta>
              {!manageable && (
                <>
                  {tOr('playlistPeople.role', { role }, '')}
                  {' · '}
                </>
              )}
              <time dateTime={joinedAt}>{joined}</time>
            </CollaboratorList.Meta>
            {manageable && (
              <CollaboratorList.Actions>
                <Select.Root
                  value={role}
                  onValueChange={(next) =>
                    isRole(next) && changeRole.mutate({ userId, role: next })
                  }
                >
                  <Select.Trigger
                    size="sm"
                    aria-label={tOr('playlistPeople.roleFor', { name }, '')}
                  >
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {PLAYLIST_COLLABORATOR_ROLES.map((option) => (
                      <Select.Item key={option} value={option}>
                        {tOr('playlistPeople.role', { role: option }, '')}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                <IconButton
                  size="sm"
                  variant="ghost"
                  tone="danger"
                  aria-label={tOr('playlistPeople.removeFor', { name }, '')}
                  onClick={() => remove.mutate(userId)}
                >
                  <Icon name="trash" />
                </IconButton>
              </CollaboratorList.Actions>
            )}
          </CollaboratorList.Item>
        );
      })}
    </CollaboratorList.Root>
  );
}
