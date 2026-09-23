import { expectOk } from '@vp/testing/result';
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

  it('attributes an event to the owner of a video built after it', async () => {
    const repositories = await seeded();

    const events = expectOk(await repositories.events.findAfterIdForUser(OWNER, 0));

    expect(events.map((event) => event.type)).toEqual(['video.uploaded']);
  });

  it('empties every repository it registered on clear', async () => {
    const repositories = await seeded();

    repositories.clear();

    expect(expectOk(await repositories.videos.findById(VIDEO))).toBeNull();
    expect(expectOk(await repositories.uploads.findById(UPLOAD))).toBeNull();
    expect(expectOk(await repositories.events.findAfterIdForUser(OWNER, 0))).toEqual([]);
  });
});
