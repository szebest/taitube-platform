import type { QueueJob } from '@kit/ports';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NotifyPlaylistUpdateJob } from '@vp/job-contracts';
import { createNotifyPlaylistUpdateProcessor } from '../notify-playlist-update';
import { CREATOR_ID, logger, notificationsOf, seedCreator, userId } from './notification-harness';

const EDITOR = userId(7);
const PLAYLIST = '00000000-0000-7000-8000-000000000b01';

describe('apps/server/worker/stages: notify-playlist-update', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    expectOk(
      await repositories.playlists.create({
        id: PLAYLIST,
        ownerId: CREATOR_ID,
        title: 'Road trip',
        description: '',
        visibility: 'private',
      })
    );
  });

  const notify = async (actorUserId: string, hour = '2026-11-26T12') => {
    const job: QueueJob<NotifyPlaylistUpdateJob> = {
      id: `${PLAYLIST}--notify-playlist-update--${actorUserId}--${hour}`,
      name: 'notify-playlist-update',
      data: { playlistId: PLAYLIST, actorUserId, hour },
    };
    return expectOk(await createNotifyPlaylistUpdateProcessor({ repositories, logger })(job));
  };

  it('tells the owner once per playlist, however many hours of changes arrive', async () => {
    expect(await notify(EDITOR)).toEqual({ playlistId: PLAYLIST, recorded: true });
    await notify(EDITOR, '2026-11-26T13');

    expect(await notificationsOf(repositories, CREATOR_ID)).toMatchObject([
      {
        kind: 'playlist_update',
        payload: { playlist: { id: PLAYLIST, title: 'Road trip', invite: null } },
      },
    ]);
  });

  it.each([{ scenario: 'the owner made the change', actor: CREATOR_ID }])(
    'says nothing when $scenario',
    async ({ actor }) => {
      expect(await notify(actor)).toEqual({ playlistId: PLAYLIST, recorded: false });
      expect(await notificationsOf(repositories, CREATOR_ID)).toEqual([]);
    }
  );
});
