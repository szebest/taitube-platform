import type { WatchPartyPersonalControlRepositoryPort } from '@vp/core/repositories';
import { isNoPersonalControl, type PersonalControlRecord } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { controlKey, type InMemoryWatchPartyStore } from './in-memory-watch-party-store';

export class InMemoryWatchPartyPersonalControlRepository implements WatchPartyPersonalControlRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async list(
    userId: string,
    roomId: string | null
  ): Promise<Result<PersonalControlRecord[], DatabaseUnavailable>> {
    const listed = [...this.store.controls.values()].filter(
      (control) =>
        control.userId === userId &&
        (control.roomId === null || (roomId !== null && control.roomId === roomId))
    );
    return ok(listed.map((control) => ({ ...control })));
  }

  async put(record: PersonalControlRecord): Promise<Result<void, DatabaseUnavailable>> {
    const key = controlKey(record.userId, record.targetKey, record.roomId);
    if (isNoPersonalControl(record)) this.store.controls.delete(key);
    else this.store.controls.set(key, { ...record });
    return ok(undefined);
  }

  async blockingInvitesFrom(
    inviterKey: string,
    userIds: readonly string[]
  ): Promise<Result<Set<string>, DatabaseUnavailable>> {
    const wanted = new Set(userIds);
    const blocking = [...this.store.controls.values()].filter(
      (control) =>
        wanted.has(control.userId) &&
        control.targetKey === inviterKey &&
        control.roomId === null &&
        control.blockInvites
    );
    return ok(new Set(blocking.map((control) => control.userId)));
  }

  clear(): void {
    this.store.clear();
  }
}
