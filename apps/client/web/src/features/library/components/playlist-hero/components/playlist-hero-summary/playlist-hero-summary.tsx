import { Badge, Icon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { PlaylistView } from '@vp/api-contracts';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useT } from '#app/lib/messages';
import { CollaboratorStack } from '../collaborator-stack/collaborator-stack';
import { ForkAttribution } from '../fork-attribution/fork-attribution';

export interface PlaylistHeroSummaryProps {
  playlist: PlaylistView;
  /** The viewer is the owner or a collaborator, so the faces of the others can be read. */
  seesCollaborators: boolean;
}

function totalDurationMs(playlist: PlaylistView): number {
  return playlist.items.reduce((total, { video }) => total + (video.durationMs ?? 0), 0);
}

/** The title and what the playlist is: its owner, what it was forked from, its rules, who works on it. */
export function PlaylistHeroSummary({ playlist, seesCollaborators }: PlaylistHeroSummaryProps) {
  const { tOr } = useT();
  const { spoken } = useDurationText(totalDurationMs(playlist));

  const { id, title, description, visibility, owner, rules, forkedFromPlaylistId } = playlist;

  return (
    <>
      <h1 className="m-0 text-headline">{title}</h1>
      {rules && (
        <p className="m-0 flex flex-wrap items-center gap-inline text-caption text-fg-muted">
          <Badge size="sm" tone="accent">
            <Icon name="filter" size="sm" />
            {tOr('playlistPeople.smartBadge', {}, '')}
          </Badge>
          {tOr(
            'playlistPeople.smartSummary',
            { mode: rules.match, count: rules.conditions.length, max: rules.limit },
            ''
          )}
        </p>
      )}
      {owner && (
        <Link to="/channel/$channelId" params={{ channelId: owner.id }} className="text-label">
          {tOr('library.playlistOwner', { name: owner.displayName }, '')}
        </Link>
      )}
      {forkedFromPlaylistId && <ForkAttribution sourceId={forkedFromPlaylistId} />}
      <p className="m-0 text-caption text-fg-muted">
        {tOr(
          'library.playlistDuration',
          { count: playlist.videoCount, duration: spoken ?? '' },
          ''
        )}
        {' · '}
        {tOr('videos.visibility', { visibility }, '')}
      </p>
      <CollaboratorStack playlistId={id} enabled={seesCollaborators} />
      {description && <p className="m-0 whitespace-pre-line text-body">{description}</p>}
    </>
  );
}
