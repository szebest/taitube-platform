import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, ok } from '@kit/result';
import type {
  ListPlaylistActivityOptions,
  OutboxRepository,
  PlaylistActivityRepositoryPort,
  UserEventRepository,
} from '@vp/core/repositories';
import {
  type PlaylistActivity,
  type PlaylistActivityEntry,
  coalescesWith,
  playlistAudience,
  playlistUpdateHour,
  playlistUpdated,
} from '@vp/domain';
import { playlistUpdateOutbox } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import type { Clock } from './clock';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keysetOf = ({ createdAt, id }: PlaylistActivity) => ({ sort: createdAt, tie: id });

export interface PlaylistPeople {
  ownerId: string;
  collaboratorIds: readonly string[];
}

export interface InMemoryPlaylistActivityDeps {
  userEvents: Pick<UserEventRepository, 'append'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
  now: Clock;
}

/** The log, and the bookkeeping every playlist write does, as `recordPlaylistChange` does it. */
export class InMemoryPlaylistActivityRepository implements PlaylistActivityRepositoryPort {
  private rows: PlaylistActivity[] = [];

  constructor(private readonly deps: InMemoryPlaylistActivityDeps) {}

  async record(
    playlistId: string,
    actorId: string,
    entries: readonly PlaylistActivityEntry[],
    people: PlaylistPeople
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (entries.length === 0) return ok();
    const now = new Date(this.deps.now());
    for (const entry of entries) {
      const latest = this.newestOf(playlistId);
      if (latest && coalescesWith(latest, { ...entry, actorUserId: actorId }, now)) {
        this.rows = this.rows.map((row) => (row === latest ? { ...row, createdAt: now } : row));
        continue;
      }
      this.rows.push({ ...entry, id: uuidv7(), playlistId, actorUserId: actorId, createdAt: now });
    }

    for (const userId of playlistAudience(people.ownerId, people.collaboratorIds, actorId)) {
      const told = await this.deps.userEvents.append({ userId, ...playlistUpdated(playlistId) });
      if (isErr(told)) return told;
    }
    if (actorId === people.ownerId) return ok();
    const queued = await this.deps.outbox.enqueue(
      playlistUpdateOutbox({ playlistId, actorUserId: actorId, hour: playlistUpdateHour(now) })
    );
    return isErr(queued) ? queued : ok();
  }

  async list(
    playlistId: string,
    { cursor, limit }: ListPlaylistActivityOptions
  ): Promise<Result<PlaylistActivity[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    return ok(
      this.rows
        .filter((row) => row.playlistId === playlistId && isKeysetBefore(keysetOf(row), after))
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
    );
  }

  async find(id: string): Promise<Result<PlaylistActivity | null, DatabaseUnavailable>> {
    return ok(this.rows.find((row) => row.id === id) ?? null);
  }

  async purgeOlderThan(before: Date): Promise<Result<number, DatabaseUnavailable>> {
    const kept = this.rows.filter((row) => row.createdAt.getTime() >= before.getTime());
    const purged = this.rows.length - kept.length;
    this.rows = kept;
    return ok(purged);
  }

  clear(): void {
    this.rows = [];
  }

  private newestOf(playlistId: string): PlaylistActivity | null {
    return (
      this.rows
        .filter((row) => row.playlistId === playlistId)
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))[0] ?? null
    );
  }
}
