import * as schema from '@vp/db';
import { captionsReady } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, seedOwners, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { lockTrack, record, replaceCues } from '../caption-writes';
import { PostgresRepositories } from '../postgres-repositories';

const TRACK_ID = '00000000-0000-7000-8000-0000000004a1';

async function seeded() {
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  await repositories.videos.create({
    id: VIDEO_IDS.a,
    ownerId: OWNER_ID,
    sourceKey: 'raw/a/source.mp4',
    title: 'A',
  });
  const created = await repositories.captions.createGenerated({
    id: TRACK_ID,
    videoId: VIDEO_IDS.a,
    language: null,
    modelVersion: 'whisper-1',
    status: 'pending',
    reason: null,
  });
  return { db, engine, track: expectOk(created) };
}

describe('caption writes', () => {
  it('stores more cues than one insert batch holds, replacing what was there', async () => {
    const { db, engine } = await seeded();
    const cues = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        index,
        startMs: index,
        endMs: index + 1,
        text: `cue ${index}`,
      }));

    await db.transaction(async (tx) => {
      await replaceCues(tx, TRACK_ID, cues(3));
      await replaceCues(tx, TRACK_ID, cues(2500));
    });

    const stored = await db
      .select({ index: schema.videoTranscriptCues.cueIndex })
      .from(schema.videoTranscriptCues)
      .where(eq(schema.videoTranscriptCues.captionId, TRACK_ID))
      .orderBy(asc(schema.videoTranscriptCues.cueIndex));
    expect(stored.map(({ index }) => index)).toEqual(cues(2500).map(({ index }) => index));
    await engine.close();
  });

  it('locks a track only at the version it was asked for', async () => {
    const { db, engine } = await seeded();

    const found = await db.transaction(async (tx) => ({
      atVersion: await lockTrack(tx, TRACK_ID, 1),
      atOther: await lockTrack(tx, TRACK_ID, 2),
    }));

    expect(found.atVersion?.id).toBe(TRACK_ID);
    expect(found.atOther).toBeNull();
    await engine.close();
  });

  it('records the video event and announces to the owner only when asked', async () => {
    const { db, engine, track } = await seeded();

    await db.transaction(async (tx) => {
      await record(tx, 'captions.edited', track);
      await record(
        tx,
        'captions.ready',
        track,
        captionsReady(VIDEO_IDS.a, { id: TRACK_ID, language: 'en', kind: 'auto' })
      );
    });

    const events = await db.select({ type: schema.videoEvents.type }).from(schema.videoEvents);
    const announced = await db.select({ userId: schema.userEvents.userId }).from(schema.userEvents);
    expect(events.map(({ type }) => type)).toEqual(['captions.edited', 'captions.ready']);
    expect(announced).toEqual([{ userId: OWNER_ID }]);
    await engine.close();
  });
});
