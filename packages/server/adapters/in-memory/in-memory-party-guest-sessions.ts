import type { PartyGuestSession, PartyGuestSessionsPort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export class InMemoryPartyGuestSessions implements PartyGuestSessionsPort {
  private readonly sessions = new Map<string, { session: PartyGuestSession; endsAtMs: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async issue(
    credential: string,
    session: PartyGuestSession,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    this.sessions.set(credential, { session, endsAtMs: this.now() + ttlSeconds * 1000 });
    return ok();
  }

  async resolve(
    credential: string,
    ttlSeconds: number
  ): Promise<Result<PartyGuestSession | null, CacheUnavailable>> {
    const held = this.sessions.get(credential);
    const nowMs = this.now();
    if (!held || held.endsAtMs <= nowMs) {
      this.sessions.delete(credential);
      return ok(null);
    }

    held.endsAtMs = nowMs + ttlSeconds * 1000;
    return ok(held.session);
  }

  async revoke(credential: string): Promise<Result<void, CacheUnavailable>> {
    this.sessions.delete(credential);
    return ok();
  }

  clear(): void {
    this.sessions.clear();
  }
}
