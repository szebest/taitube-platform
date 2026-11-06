import type {
  LiveChatAdmission,
  LiveChatAdmissionRules,
  LiveChatGatePort,
  LiveChatTicketGrant,
} from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

interface Window {
  count: number;
  endsAtMs: number;
}

const secondsUntil = (endsAtMs: number, nowMs: number) =>
  Math.max(1, Math.ceil((endsAtMs - nowMs) / 1000));

/** One-time tokens never expire here; a spec that cares about the clock passes `now`. */
export class InMemoryLiveChatGate implements LiveChatGatePort {
  private readonly tickets = new Map<string, LiveChatTicketGrant>();
  private readonly bursts = new Map<string, Window>();
  private readonly slowUntil = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  async issueTicket(
    ticket: string,
    grant: LiveChatTicketGrant,
    _ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    this.tickets.set(ticket, { ...grant });
    return ok();
  }

  async redeemTicket(
    ticket: string
  ): Promise<Result<LiveChatTicketGrant | null, CacheUnavailable>> {
    const grant = this.tickets.get(ticket) ?? null;
    this.tickets.delete(ticket);
    return ok(grant);
  }

  async admit(
    liveStreamId: string,
    userId: string,
    rules: LiveChatAdmissionRules
  ): Promise<Result<LiveChatAdmission, CacheUnavailable>> {
    const key = `${liveStreamId}:${userId}`;
    const nowMs = this.now();

    const open = this.bursts.get(key);
    const burst =
      open && open.endsAtMs > nowMs
        ? open
        : { count: 0, endsAtMs: nowMs + rules.burst.windowSeconds * 1000 };
    burst.count += 1;
    this.bursts.set(key, burst);
    if (burst.count > rules.burst.messages) {
      return ok({ type: 'refused', retryAfterSeconds: secondsUntil(burst.endsAtMs, nowMs) });
    }

    if (rules.slowModeSeconds === 0) return ok({ type: 'admitted' });
    const until = this.slowUntil.get(key) ?? 0;
    if (until > nowMs)
      return ok({ type: 'refused', retryAfterSeconds: secondsUntil(until, nowMs) });
    this.slowUntil.set(key, nowMs + rules.slowModeSeconds * 1000);
    return ok({ type: 'admitted' });
  }

  clear(): void {
    this.tickets.clear();
    this.bursts.clear();
    this.slowUntil.clear();
  }
}
