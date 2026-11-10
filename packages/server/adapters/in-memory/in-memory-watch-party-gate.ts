import type {
  BudgetRule,
  GateAdmission,
  WatchPartyBudget,
  WatchPartyGatePort,
  WatchPartyTicketGrant,
} from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

interface Window {
  count: number;
  endsAtMs: number;
}

const ADMITTED: GateAdmission = { type: 'admitted' };

const secondsUntil = (endsAtMs: number, nowMs: number) =>
  Math.max(1, Math.ceil((endsAtMs - nowMs) / 1000));

const refusedUntil = (endsAtMs: number, nowMs: number): GateAdmission => ({
  type: 'refused',
  retryAfterSeconds: secondsUntil(endsAtMs, nowMs),
});

export class InMemoryWatchPartyGate implements WatchPartyGatePort {
  private readonly tickets = new Map<string, { grant: WatchPartyTicketGrant; endsAtMs: number }>();
  private readonly budgets = new Map<string, Window>();
  private readonly slowUntil = new Map<string, number>();
  private readonly rolesVersions = new Map<string, number>();
  private readonly skipVotes = new Map<string, Set<string>>();

  constructor(private readonly now: () => number = Date.now) {}

  async issueTicket(
    ticket: string,
    grant: WatchPartyTicketGrant,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    this.tickets.set(ticket, { grant: { ...grant }, endsAtMs: this.now() + ttlSeconds * 1000 });
    return ok();
  }

  async redeemTicket(
    ticket: string
  ): Promise<Result<WatchPartyTicketGrant | null, CacheUnavailable>> {
    const issued = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return ok(issued && issued.endsAtMs > this.now() ? issued.grant : null);
  }

  async consume(
    budget: WatchPartyBudget,
    scope: string,
    rule: BudgetRule
  ): Promise<Result<GateAdmission, CacheUnavailable>> {
    const key = `${budget}:${scope}`;
    const nowMs = this.now();
    const open = this.openWindow(key, nowMs);
    const window = open ?? { count: 0, endsAtMs: nowMs + rule.windowSeconds * 1000 };
    window.count += 1;
    this.budgets.set(key, window);

    return ok(window.count > rule.limit ? refusedUntil(window.endsAtMs, nowMs) : ADMITTED);
  }

  async release(budget: WatchPartyBudget, scope: string): Promise<Result<void, CacheUnavailable>> {
    const open = this.openWindow(`${budget}:${scope}`, this.now());
    if (open) open.count = Math.max(0, open.count - 1);
    return ok();
  }

  async reset(budget: WatchPartyBudget, scope: string): Promise<Result<void, CacheUnavailable>> {
    this.budgets.delete(`${budget}:${scope}`);
    return ok();
  }

  async slowMode(
    roomId: string,
    memberKey: string,
    seconds: number
  ): Promise<Result<GateAdmission, CacheUnavailable>> {
    if (seconds <= 0) return ok(ADMITTED);

    const key = `${roomId}:${memberKey}`;
    const nowMs = this.now();
    const until = this.slowUntil.get(key) ?? 0;
    if (until > nowMs) return ok(refusedUntil(until, nowMs));

    this.slowUntil.set(key, nowMs + seconds * 1000);
    return ok(ADMITTED);
  }

  async setRolesVersion(
    roomId: string,
    rolesVersion: number
  ): Promise<Result<void, CacheUnavailable>> {
    this.rolesVersions.set(roomId, rolesVersion);
    return ok();
  }

  async rolesVersion(roomId: string): Promise<Result<number | null, CacheUnavailable>> {
    return ok(this.rolesVersions.get(roomId) ?? null);
  }

  async voteSkip(
    roomId: string,
    itemId: string,
    memberKey: string
  ): Promise<Result<number, CacheUnavailable>> {
    const key = `${roomId}:${itemId}`;
    const votes = new Set(this.skipVotes.get(key)).add(memberKey);
    this.skipVotes.set(key, votes);
    return ok(votes.size);
  }

  async clearSkipVotes(roomId: string, itemId: string): Promise<Result<void, CacheUnavailable>> {
    this.skipVotes.delete(`${roomId}:${itemId}`);
    return ok();
  }

  clear(): void {
    this.tickets.clear();
    this.budgets.clear();
    this.slowUntil.clear();
    this.rolesVersions.clear();
    this.skipVotes.clear();
  }

  private openWindow(key: string, nowMs: number): Window | undefined {
    const window = this.budgets.get(key);
    return window && window.endsAtMs > nowMs ? window : undefined;
  }
}
