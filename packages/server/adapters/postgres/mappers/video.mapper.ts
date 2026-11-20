import type { VideoRecord } from '@vp/core/repositories';
import type { videos } from '@vp/db';

type VideoRow = typeof videos.$inferSelect;

/** The only way a `videos` row leaves an adapter: the password hash stays behind `VideoPasswordRepository`. */
export function toVideoRecord({ accessPasswordHash, ...row }: VideoRow): VideoRecord {
  return { ...row, passwordProtected: accessPasswordHash !== null };
}
