import { Button, Icon } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { useCopyPlaylist } from '#app/features/library/hooks/use-copy-playlist';
import { useFollowPlaylist } from '#app/features/library/hooks/use-follow-playlist';
import { usePinPlaylist } from '#app/features/library/hooks/use-pin-playlist';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';

export interface PlaylistHeroActionsProps {
  playlist: PlaylistView;
  abilities: PlaylistAbilities;
}

/**
 * Follow, Fork and Pin. A guest sees Follow and Fork and gets the sign-in prompt from them; a member
 * sees each only where the rules let them.
 */
export function PlaylistHeroActions({ playlist, abilities }: PlaylistHeroActionsProps) {
  const { tOr } = useT();
  const account = useRequireAccount('playlist');
  const follow = useFollowPlaylist(playlist.id, account.allowed && abilities.follow);
  const fork = useCopyPlaylist(playlist.id, 'fork');
  const pin = usePinPlaylist(playlist.id);

  const pinned = playlist.pinnedAt !== null;
  const showFollow = !account.allowed || abilities.follow;

  return (
    <>
      {showFollow && (
        <Button
          variant={follow.following ? 'soft' : 'solid'}
          aria-pressed={follow.following}
          loading={follow.isPending}
          onClick={() => account.run(follow.toggle)}
        >
          <Icon name={follow.following ? 'check' : 'following'} />
          {tOr(follow.following ? 'playlistPeople.following' : 'playlistPeople.follow', {}, '')}
        </Button>
      )}
      <Button
        variant="soft"
        loading={fork.isPending}
        onClick={() => account.run(() => fork.mutate())}
      >
        <Icon name="save" />
        {tOr('playlistPeople.fork', {}, '')}
      </Button>
      {abilities.pin && (
        <Button
          variant="soft"
          aria-pressed={pinned}
          loading={pin.isPending}
          onClick={() => pin.mutate(!pinned)}
        >
          <Icon name="pin" />
          {tOr(pinned ? 'playlistPeople.unpin' : 'playlistPeople.pin', {}, '')}
        </Button>
      )}
    </>
  );
}
