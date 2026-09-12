import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbClient } from './client';
import { renditions, users, videos } from './schema';

export const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
export const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
export const SEED_VIDEO_ID = '018f0000-0000-7000-8000-000000000001';
export const OTHER_PRIVATE_VIDEO_ID = '018f0000-0000-7000-8000-000000000002';

export async function seedDatabase(connectionUrl?: string): Promise<void> {
  const { db, sql } = createDbClient(connectionUrl);

  let connected = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await sql`SELECT 1`;
      connected = true;
      break;
    } catch (err) {
      console.warn(
        `[db:seed] Database connection attempt ${attempt}/15 failed (${(err as Error).message}), retrying in 1s...`
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!connected) {
    throw new Error('[db:seed] Failed to connect to database after 15 attempts');
  }

  console.log('[db:seed] Seeding database...');

  // 1. Seed dev users
  await db
    .insert(users)
    .values({
      id: DEV_USER_ID,
      email: 'dev@video-pipeline.local',
      tier: 'pro',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: 'dev@video-pipeline.local',
        tier: 'pro',
      },
    });

  await db
    .insert(users)
    .values({
      id: OTHER_USER_ID,
      email: 'other@video-pipeline.local',
      tier: 'free',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: 'other@video-pipeline.local',
        tier: 'free',
      },
    });

  // 2. Seed READY video owned by DEV_USER_ID
  const ladder = [
    { name: '1080p', width: 1920, height: 1080, videoKbps: 5000, audioKbps: 128 },
    { name: '720p', width: 1280, height: 720, videoKbps: 2800, audioKbps: 128 },
    { name: '480p', width: 854, height: 480, videoKbps: 1400, audioKbps: 96 },
  ];

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
        sourceKey: `raw/${SEED_VIDEO_ID}/source.mp4`,
        sourceSizeBytes: 15200000,
        sourceContentType: 'video/mp4',
        durationMs: 52000,
        width: 1920,
        height: 1080,
        fps: '24.000',
        videoCodec: 'h264',
        audioCodec: 'aac',
        ladder,
        masterPlaylistKey: `videos/${SEED_VIDEO_ID}/hls/master.m3u8`,
        posterKey: `videos/${SEED_VIDEO_ID}/thumbs/poster.jpg`,
        spriteKey: `videos/${SEED_VIDEO_ID}/thumbs/sprite.jpg`,
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
        sourceKey: `raw/${OTHER_PRIVATE_VIDEO_ID}/source.mp4`,
        sourceSizeBytes: 10000000,
        sourceContentType: 'video/mp4',
        durationMs: 30000,
        width: 1280,
        height: 720,
        fps: '30.000',
        videoCodec: 'h264',
        audioCodec: 'aac',
        ladder: ladder.slice(1),
        masterPlaylistKey: `videos/${OTHER_PRIVATE_VIDEO_ID}/hls/master.m3u8`,
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

  // 3. Seed renditions for SEED_VIDEO_ID
  await db
    .insert(renditions)
    .values([
      {
        id: '018f0000-0000-7000-8000-000000000010',
        videoId: SEED_VIDEO_ID,
        name: '1080p',
        width: 1920,
        height: 1080,
        videoBitrateKbps: 5000,
        audioBitrateKbps: 128,
        status: 'DONE',
        playlistKey: `videos/${SEED_VIDEO_ID}/hls/1080p/index.m3u8`,
        segmentCount: 9,
        bytes: 32000000,
        processingMs: 8400,
      },
      {
        id: '018f0000-0000-7000-8000-000000000011',
        videoId: SEED_VIDEO_ID,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
        status: 'DONE',
        playlistKey: `videos/${SEED_VIDEO_ID}/hls/720p/index.m3u8`,
        segmentCount: 9,
        bytes: 18000000,
        processingMs: 5100,
      },
      {
        id: '018f0000-0000-7000-8000-000000000012',
        videoId: SEED_VIDEO_ID,
        name: '480p',
        width: 854,
        height: 480,
        videoBitrateKbps: 1400,
        audioBitrateKbps: 96,
        status: 'DONE',
        playlistKey: `videos/${SEED_VIDEO_ID}/hls/480p/index.m3u8`,
        segmentCount: 9,
        bytes: 9000000,
        processingMs: 3200,
      },
    ])
    .onConflictDoUpdate({
      target: renditions.id,
      set: {
        status: 'DONE',
      },
    });

  console.log('[db:seed] Seed completed successfully: Dev user + READY video created.');
  await sql.end();
}

// Auto-run if executed directly
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:seed] Seed failed:', err);
      process.exit(1);
    });
}
