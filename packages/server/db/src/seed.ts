import { CANONICAL_LADDER, type RenditionName } from '@vp/job-contracts';
import { isErr } from '@vp/result';
import {
  masterPlaylistKey,
  posterKey,
  rawSourceKey,
  renditionPlaylistKey,
  spriteKey,
} from '@vp/storage';
import { createDbClient, waitForDatabase } from './client';
import { renditions, users, videos } from './schema';

const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
const SEED_VIDEO_ID = '018f0000-0000-7000-8000-000000000001';
const OTHER_PRIVATE_VIDEO_ID = '018f0000-0000-7000-8000-000000000002';

const SEED_USERS = [
  { id: DEV_USER_ID, email: 'dev@video-pipeline.local', tier: 'pro' },
  { id: OTHER_USER_ID, email: 'other@video-pipeline.local', tier: 'free' },
] as const;

const SEED_RENDITIONS: Record<RenditionName, { id: string; bytes: number; processingMs: number }> =
  {
    '1080p': { id: '018f0000-0000-7000-8000-000000000010', bytes: 32000000, processingMs: 8400 },
    '720p': { id: '018f0000-0000-7000-8000-000000000011', bytes: 18000000, processingMs: 5100 },
    '480p': { id: '018f0000-0000-7000-8000-000000000012', bytes: 9000000, processingMs: 3200 },
  };

export async function seedDatabase(connectionUrl: string): Promise<void> {
  const { db, sql } = createDbClient(connectionUrl);

  const reached = await waitForDatabase(() => sql`SELECT 1`, { label: 'db:seed' });
  if (isErr(reached)) throw reached.error;

  console.log('[db:seed] Seeding database...');

  for (const { id, email, tier } of SEED_USERS) {
    await db
      .insert(users)
      .values({ id, email, tier })
      .onConflictDoUpdate({ target: users.id, set: { email, tier } });
  }

  const ladder = CANONICAL_LADDER.map(({ name, width, height, videoKbps, audioKbps }) => ({
    name,
    width,
    height,
    videoKbps,
    audioKbps,
  }));

  await db
    .insert(videos)
    .values([
      {
        id: SEED_VIDEO_ID,
        ownerId: DEV_USER_ID,
        title: 'Test Sintel Trailer',
        description: 'Open-source Blender movie trailer sample',
        visibility: 'public',
        status: 'READY',
        sourceKey: rawSourceKey(SEED_VIDEO_ID),
        sourceSizeBytes: 15200000,
        sourceContentType: 'video/mp4',
        durationMs: 52000,
        width: 1920,
        height: 1080,
        fps: 24,
        videoCodec: 'h264',
        audioCodec: 'aac',
        ladder,
        masterPlaylistKey: masterPlaylistKey(SEED_VIDEO_ID),
        posterKey: posterKey(SEED_VIDEO_ID),
        spriteKey: spriteKey(SEED_VIDEO_ID),
        version: 1,
        readyAt: new Date(),
      },
      {
        id: OTHER_PRIVATE_VIDEO_ID,
        ownerId: OTHER_USER_ID,
        title: 'Other User Private Video',
        description: 'Should not be visible to DEV_USER_ID',
        visibility: 'private',
        status: 'READY',
        sourceKey: rawSourceKey(OTHER_PRIVATE_VIDEO_ID),
        sourceSizeBytes: 10000000,
        sourceContentType: 'video/mp4',
        durationMs: 30000,
        width: 1280,
        height: 720,
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac',
        ladder: ladder.slice(1),
        masterPlaylistKey: masterPlaylistKey(OTHER_PRIVATE_VIDEO_ID),
        version: 1,
        readyAt: new Date(),
      },
    ])
    .onConflictDoUpdate({
      target: videos.id,
      set: {
        status: 'READY',
        title: 'Test Sintel Trailer',
      },
    });

  await db
    .insert(renditions)
    .values(
      CANONICAL_LADDER.map((rung) => ({
        ...SEED_RENDITIONS[rung.name],
        videoId: SEED_VIDEO_ID,
        name: rung.name,
        width: rung.width,
        height: rung.height,
        videoBitrateKbps: rung.videoKbps,
        audioBitrateKbps: rung.audioKbps,
        status: 'DONE' as const,
        playlistKey: renditionPlaylistKey(SEED_VIDEO_ID, rung.name),
        segmentCount: 9,
      }))
    )
    .onConflictDoUpdate({
      target: renditions.id,
      set: {
        status: 'DONE',
      },
    });

  console.log('[db:seed] Seed completed successfully: Dev user + READY video created.');
  await sql.end();
}
