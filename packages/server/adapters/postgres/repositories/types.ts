import { DatabaseError } from '@vp/core/ports';
import type * as schema from '@vp/db';

export type VideoStatus = (typeof schema.videoStatusEnum.enumValues)[number];
export type VideoInsert = typeof schema.videos.$inferInsert;
export type VideoEventInsert = typeof schema.videoEvents.$inferInsert;

export const toDbError = (op: string, err: unknown): DatabaseError =>
  err instanceof DatabaseError
    ? err
    : new DatabaseError(`${op}: ${(err as Error).message}`, { cause: err });
