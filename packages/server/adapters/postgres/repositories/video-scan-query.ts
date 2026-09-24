import type { VideoScan, VideoScanAbsence } from '@vp/core/repositories';
import { processingSteps, videoEvents, videos } from '@vp/db';
import { assertNever } from '@vp/result';
import { type SQL, and, eq, sql } from 'drizzle-orm';
import { drizzleWhere } from '../scopes/index';

function absenceScope(absence: VideoScanAbsence): SQL {
  switch (absence.type) {
    case 'step':
      return sql`not exists (select 1 from ${processingSteps} where ${and(
        eq(processingSteps.videoId, videos.id),
        eq(processingSteps.step, absence.step)
      )})`;
    case 'event':
      return sql`not exists (select 1 from ${videoEvents} where ${drizzleWhere(
        eq(videoEvents.videoId, videos.id),
        eq(videoEvents.type, absence.event),
        absence.forCurrentGeneration
          ? sql`(${videoEvents.payload}->>'generation')::int >= ${videos.generation}`
          : undefined
      )})`;
    default:
      return assertNever(absence, 'VideoScanAbsence');
  }
}

export function videoScanScope(filter: VideoScan, now: Date): SQL | undefined {
  const { status, idleFor, minGeneration, without } = filter;
  const idleSince = idleFor && new Date(now.getTime() - idleFor.ms).toISOString();
  return drizzleWhere(
    eq(videos.status, status),
    idleFor &&
      sql`COALESCE(${videos[idleFor.since]}, ${videos.updatedAt}) < ${idleSince}::timestamptz`,
    minGeneration !== undefined ? sql`${videos.generation} >= ${minGeneration}` : undefined,
    without && absenceScope(without)
  );
}
