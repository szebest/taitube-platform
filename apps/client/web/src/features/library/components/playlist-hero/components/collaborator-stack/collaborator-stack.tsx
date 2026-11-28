import { Avatar } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { playlistCollaboratorsQueryOptions } from '#app/features/library/api/playlist-queries';
import { useT } from '#app/lib/messages';

const SHOWN = 4;

export interface CollaboratorStackProps {
  playlistId: string;
  /** Only the owner and the collaborators may list them; anyone else asks for nothing. */
  enabled: boolean;
}

/** The faces of the people working on the playlist, a few overlapping, with how many more there are. */
export function CollaboratorStack({ playlistId, enabled }: CollaboratorStackProps) {
  const { tOr } = useT();
  const { data } = useQuery({
    ...playlistCollaboratorsQueryOptions(useApi(), playlistId),
    enabled,
  });

  const people = data?.items ?? [];
  const hidden = people.length - SHOWN;

  if (people.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-inline">
      <ul
        aria-label={tOr('playlistPeople.collaboratorsLabel', {}, '')}
        className="m-0 flex list-none p-0 [&>li+li]:-ms-2"
      >
        {people.slice(0, SHOWN).map(({ userId, channel }) => {
          const name = channel?.displayName ?? tOr('playlistPeople.someone', {}, '');
          return (
            <li key={userId}>
              <Avatar.Root size="sm" className="ring-2 ring-bg" title={name}>
                {channel?.avatarUrl && <Avatar.Image src={channel.avatarUrl} alt={name} />}
                <Avatar.Fallback aria-label={name}>{name.slice(0, 1)}</Avatar.Fallback>
              </Avatar.Root>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <span className="text-caption text-fg-muted">
          {tOr('playlistPeople.moreCollaborators', { count: hidden }, '')}
        </span>
      )}
    </div>
  );
}
