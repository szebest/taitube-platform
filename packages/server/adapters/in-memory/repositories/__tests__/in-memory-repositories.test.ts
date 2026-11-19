import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '../in-memory-repositories';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const VIDEO = '00000000-0000-7000-8000-0000000000a2';
const UPLOAD = '00000000-0000-7000-8000-0000000000a3';

async function seeded(): Promise<InMemoryRepositories> {
  const repositories = new InMemoryRepositories();
  expectOk(
    await repositories.videos.create({
      id: VIDEO,
      ownerId: OWNER,
      channelId: 'owner-channel',
      title: 'Wiring fixture',
      visibility: 'public',
      status: 'UPLOADED',
      sourceKey: 'raw/wiring.mp4',
    })
  );
  expectOk(
    await repositories.uploads.create({
      id: UPLOAD,
      videoId: VIDEO,
      strategy: 'single',
      declaredSizeBytes: 1024,
      declaredContentType: 'video/mp4',
      expiresAt: new Date(Date.now() + 60_000),
    })
  );
  expectOk(
    await repositories.events.create({ videoId: VIDEO, type: 'video.uploaded', payload: {} })
  );
  return repositories;
}

describe('InMemoryRepositories', () => {
  it('reads a video back with the upload built after it', async () => {
    const repositories = await seeded();

    const details = expectOk(await repositories.videos.findWithDetails(VIDEO));

    expect(details?.upload?.id).toBe(UPLOAD);
  });

  it('empties every repository it registered on clear', async () => {
    const repositories = await seeded();

    repositories.clear();

    expect(expectOk(await repositories.videos.findById(VIDEO))).toBeNull();
    expect(expectOk(await repositories.uploads.findById(UPLOAD))).toBeNull();
    expect(expectOk(await repositories.events.findByVideoId(VIDEO))).toEqual([]);
  });

  it('tells an invite expired by the clock it was given, not the real one', async () => {
    const start = Date.parse('2026-11-01T00:00:00Z');
    let now = start;
    const repositories = new InMemoryRepositories({ now: () => now });
    const id = '00000000-0000-7000-8000-0000000000b1';
    expectOk(
      await repositories.channelInvites.create(
        {
          id,
          channelId: '00000000-0000-7000-8000-0000000000b2',
          inviteeUserId: '00000000-0000-7000-8000-0000000000b3',
          role: 'editor',
          invitedBy: OWNER,
          expiresAt: new Date(start + 3_600_000),
        },
        {
          channelId: '00000000-0000-7000-8000-0000000000b2',
          actorUserId: OWNER,
          action: 'invite.created',
          targetType: 'invite',
          targetId: id,
          meta: { inviteeUserId: '00000000-0000-7000-8000-0000000000b3', role: 'editor' },
        }
      )
    );

    expect(expectOk(await repositories.channelInvites.findById(id))?.status).toBe('pending');

    now = start + 7_200_000;

    expect(expectOk(await repositories.channelInvites.findById(id))?.status).toBe('expired');
  });
});
