import type { PickRange, PickRepositoryPort, PickWriteFailure } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { EditorPick, EditorPickEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable, pickWindowOverlap } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, asc, eq, getTableColumns, gt, lt, ne } from 'drizzle-orm';
import { isExclusionViolation } from '../pg-errors';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import type { PostgresDatabase } from './types';

const { picks: p, videos: v, channels: ch } = schema;

interface Window {
  startsAt: Date;
  endsAt: Date;
}

/** The exclusion constraint is the only conflict this table reports. */
function writeFailure(pick: EditorPick, operation: string) {
  return (cause: unknown): PickWriteFailure =>
    isExclusionViolation(cause)
      ? pickWindowOverlap(pick.startsAt, pick.endsAt)
      : databaseUnavailable(operation, cause);
}

const overlapping = ({ startsAt, endsAt }: Window) =>
  and(lt(p.startsAt, endsAt), gt(p.endsAt, startsAt));

export class PostgresPickRepository implements PickRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(pick: EditorPick): Promise<Result<void, PickWriteFailure>> {
    const written = await fromPromise(
      () => this.db.insert(p).values(pick),
      writeFailure(pick, 'createPick')
    );
    return map(written, () => undefined);
  }

  async update(pick: EditorPick): Promise<Result<boolean, PickWriteFailure>> {
    const { id, createdAt, createdBy, ...changes } = pick;
    const rows = await fromPromise(
      () => this.db.update(p).set(changes).where(eq(p.id, id)).returning({ id: p.id }),
      writeFailure(pick, 'updatePick')
    );
    return map(rows, (updated) => updated.length > 0);
  }

  async findById(id: string): Promise<Result<EditorPick | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(p).where(eq(p.id, id)).limit(1),
      databaseUnavailable.during('findPick')
    );
    return map(rows, ([found]) => found ?? null);
  }

  async findOverlapping(
    window: Window,
    exceptId?: string
  ): Promise<Result<EditorPick | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(p)
          .where(and(overlapping(window), exceptId ? ne(p.id, exceptId) : undefined))
          .limit(1),
      databaseUnavailable.during('findOverlappingPick')
    );
    return map(rows, ([found]) => found ?? null);
  }

  async findCurrent(at: Date): Promise<Result<EditorPickEntry | null, DatabaseUnavailable>> {
    const rows = await this.entries(
      and(lt(p.startsAt, new Date(at.getTime() + 1)), gt(p.endsAt, at)),
      1
    );
    return map(rows, ([found]) => found ?? null);
  }

  async listBetween({
    from,
    to,
  }: PickRange): Promise<Result<EditorPickEntry[], DatabaseUnavailable>> {
    return this.entries(overlapping({ startsAt: from, endsAt: to }));
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(p).where(eq(p.id, id)).returning({ id: p.id }),
      databaseUnavailable.during('removePick')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  private async entries(
    where: ReturnType<typeof and>,
    limit?: number
  ): Promise<Result<EditorPickEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(() => {
      const query = this.db
        .select({ pick: getTableColumns(p), video: getTableColumns(v), ...channelCardColumns })
        .from(p)
        .innerJoin(v, eq(v.id, p.videoId))
        .leftJoin(ch, eq(ch.userId, v.ownerId))
        .where(where)
        .orderBy(asc(p.startsAt));
      return limit === undefined ? query : query.limit(limit);
    }, databaseUnavailable.during('listPicks'));
    return map(rows, (found) =>
      found.map(({ pick, video, channelId, handle, displayName, avatarUrl }) => ({
        pick,
        video,
        channel: toChannelCard({ channelId, handle, displayName, avatarUrl }),
      }))
    );
  }
}
