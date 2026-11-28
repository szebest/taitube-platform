import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { NOTIFY_PLAYLIST_INVITE, NOTIFY_PLAYLIST_UPDATE } from '@vp/job-contracts';
import { playlistNotifications } from '../playlist-notifications';
import { logger } from './notification-harness';

describe('apps/server/worker/stages: playlist notifications', () => {
  it('answers both playlist jobs of the notify queue by name', () => {
    const processors = playlistNotifications({
      repositories: new InMemoryRepositories(),
      logger,
      now: Date.now,
    });

    expect(Object.keys(processors).sort()).toEqual(
      [NOTIFY_PLAYLIST_INVITE, NOTIFY_PLAYLIST_UPDATE].sort()
    );
  });
});
