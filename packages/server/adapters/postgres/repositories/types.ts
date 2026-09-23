import type * as schema from '@vp/db';

export type VideoInsert = typeof schema.videos.$inferInsert;
export type VideoEventInsert = typeof schema.videoEvents.$inferInsert;
