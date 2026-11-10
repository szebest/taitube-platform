import type {
  PresenceAdmission,
  PresenceAdmissionRequest,
  PresentMember,
  WatchPartyPresencePort,
} from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

interface Presence {
  touchedMs: number;
  sinceMs: number;
}

export class InMemoryWatchPartyPresence implements WatchPartyPresencePort {
  private readonly rooms = new Map<string, Map<string, Presence>>();

  async admit(
    roomId: string,
    memberKey: string,
    request: PresenceAdmissionRequest
  ): Promise<Result<PresenceAdmission, CacheUnavailable>> {
    const present = this.pruned(roomId, request.staleBeforeMs);
    const known = present.get(memberKey);
    if (!known && request.limit !== null && present.size >= request.limit) {
      return ok({ type: 'full', present: present.size });
    }

    present.set(memberKey, { touchedMs: request.nowMs, sinceMs: known?.sinceMs ?? request.nowMs });
    return ok({ type: 'admitted', present: present.size });
  }

  async touch(
    roomId: string,
    memberKeys: readonly string[],
    nowMs: number
  ): Promise<Result<void, CacheUnavailable>> {
    const present = this.room(roomId);
    for (const memberKey of memberKeys) {
      present.set(memberKey, {
        touchedMs: nowMs,
        sinceMs: present.get(memberKey)?.sinceMs ?? nowMs,
      });
    }
    return ok();
  }

  async leave(roomId: string, memberKey: string): Promise<Result<void, CacheUnavailable>> {
    this.rooms.get(roomId)?.delete(memberKey);
    return ok();
  }

  async members(
    roomId: string,
    staleBeforeMs: number
  ): Promise<Result<PresentMember[], CacheUnavailable>> {
    const members = [...this.pruned(roomId, staleBeforeMs)].map(([memberKey, { sinceMs }]) => ({
      memberKey,
      sinceMs,
    }));
    return ok(
      members.sort((a, b) => a.sinceMs - b.sinceMs || a.memberKey.localeCompare(b.memberKey))
    );
  }

  clear(): void {
    this.rooms.clear();
  }

  private room(roomId: string): Map<string, Presence> {
    const present = this.rooms.get(roomId);
    if (present) return present;
    const fresh = new Map<string, Presence>();
    this.rooms.set(roomId, fresh);
    return fresh;
  }

  private pruned(roomId: string, staleBeforeMs: number): Map<string, Presence> {
    const present = this.room(roomId);
    for (const [memberKey, { touchedMs }] of present) {
      if (touchedMs < staleBeforeMs) present.delete(memberKey);
    }
    return present;
  }
}
