import { Icon } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';

export interface ForkAttributionProps {
  sourceId: string;
}

/** "Forked from" the playlist this one was copied from, by its current title, or that it is gone. */
export function ForkAttribution({ sourceId }: ForkAttributionProps) {
  const { tOr } = useT();
  const source = useQuery({ ...playlistQueryOptions(useApi(), sourceId), retry: false });

  const gone = source.isError && failureCode(source.error) === ErrorCodes.PLAYLIST_NOT_FOUND;

  if (gone) {
    return (
      <p className="m-0 flex items-center gap-1 text-caption text-fg-muted">
        <Icon name="playlist" size="sm" />
        {tOr('playlistPeople.forkedFromGone', {}, '')}
      </p>
    );
  }
  if (!source.isSuccess) {
    return null;
  }

  return (
    <p className="m-0 flex min-w-0 items-center gap-1 text-caption text-fg-muted">
      <Icon name="playlist" size="sm" />
      {tOr('playlistPeople.forkedFrom', {}, '')}
      <Link to="/playlist" search={{ list: sourceId }} className="truncate text-fg">
        {source.data.title}
      </Link>
    </p>
  );
}
