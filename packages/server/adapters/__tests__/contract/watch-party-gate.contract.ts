import { randomUUID } from 'node:crypto';
import type { WatchPartyBudget, WatchPartyGatePort, WatchPartyTicketGrant } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface WatchPartyGateSubject {
  readonly gate: WatchPartyGatePort;
  close(): Promise<void>;
}

const RULE = { limit: 3, windowSeconds: 30 };

export function describeWatchPartyGateContract(makeSubject: () => Promise<WatchPartyGateSubject>) {
  describe('WatchPartyGate contract', () => {
    let subject: WatchPartyGateSubject;
    let roomId: string;
    let scope: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      roomId = randomUUID();
      scope = randomUUID();
    });

    const consume = async (budget: WatchPartyBudget = 'chat', useScope = scope) =>
      expectOk(await subject.gate.consume(budget, useScope, RULE));
    const check = async (budget: WatchPartyBudget = 'chat') =>
      expectOk(await subject.gate.check(budget, scope, RULE));
    const spend = async (times: number, budget: WatchPartyBudget = 'chat') => {
      for (let i = 0; i < times; i += 1) await consume(budget);
    };

    it.each([
      {
        kind: 'an account',
        principal: { kind: 'user' as const, userId: randomUUID() },
        role: 'USER' as const,
      },
      {
        kind: 'a guest',
        principal: { kind: 'guest' as const, guestId: randomUUID(), name: 'Guest 4821' },
        role: null,
      },
      {
        kind: 'a Discord member',
        principal: {
          kind: 'discord' as const,
          discordUserId: '123456789012345678',
          name: 'Ana',
          avatarUrl: null,
        },
        role: null,
      },
    ])('redeems the one-time token of $kind once', async ({ principal, role }) => {
      const ticket = randomUUID();
      const grant: WatchPartyTicketGrant = { roomId, principal, role };
      expectOk(await subject.gate.issueTicket(ticket, grant, 30));

      expect(expectOk(await subject.gate.redeemTicket(ticket))).toEqual(grant);
      expect(expectOk(await subject.gate.redeemTicket(ticket))).toBeNull();
    });

    it('redeems nothing for a token nobody issued', async () => {
      expect(expectOk(await subject.gate.redeemTicket(randomUUID()))).toBeNull();
    });

    it('admits up to the limit, then refuses with a wait, for that scope and budget only', async () => {
      await spend(3);

      const refused = await consume();

      expect(refused).toMatchObject({ type: 'refused' });
      expect(refused.type === 'refused' && refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(refused.type === 'refused' && refused.retryAfterSeconds).toBeLessThanOrEqual(30);
      expect(await consume('chat', randomUUID())).toEqual({ type: 'admitted' });
      expect(await consume('command')).toEqual({ type: 'admitted' });
    });

    it('counts nothing when it checks, and refuses once the limit is spent', async () => {
      for (const _ of [1, 2, 3, 4, 5]) expect(await check()).toEqual({ type: 'admitted' });

      await spend(3);

      expect(await check()).toMatchObject({ type: 'refused' });
    });

    it('admits again after a reset', async () => {
      await spend(4);
      expect(await check()).toMatchObject({ type: 'refused' });

      expectOk(await subject.gate.reset('chat', scope));

      expect(await check()).toEqual({ type: 'admitted' });
      expect(await consume()).toEqual({ type: 'admitted' });
    });

    it('holds a member to slow mode within one room, and never when it is off', async () => {
      const claim = async (room: string, member: string, seconds = 30) =>
        expectOk(await subject.gate.slowMode(room, member, seconds));

      expect(await claim(roomId, 'user:a')).toEqual({ type: 'admitted' });
      const refused = await claim(roomId, 'user:a');

      expect(refused).toMatchObject({ type: 'refused' });
      expect(refused.type === 'refused' && refused.retryAfterSeconds).toBeLessThanOrEqual(30);
      expect(await claim(roomId, 'user:b')).toEqual({ type: 'admitted' });
      expect(await claim(randomUUID(), 'user:a')).toEqual({ type: 'admitted' });
      expect(await claim(roomId, 'user:a', 0)).toEqual({ type: 'admitted' });
    });

    it('answers null for a roles version nobody wrote, then the latest one written', async () => {
      expect(expectOk(await subject.gate.rolesVersion(roomId))).toBeNull();

      expectOk(await subject.gate.setRolesVersion(roomId, 4));
      expectOk(await subject.gate.setRolesVersion(roomId, 5));

      expect(expectOk(await subject.gate.rolesVersion(roomId))).toBe(5);
      expect(expectOk(await subject.gate.rolesVersion(randomUUID()))).toBeNull();
    });

    it('counts one skip vote per member per item, and starts over once cleared', async () => {
      const vote = async (item: string, member: string) =>
        expectOk(await subject.gate.voteSkip(roomId, item, member));
      const [item, other] = [randomUUID(), randomUUID()];

      expect([await vote(item, 'a'), await vote(item, 'a'), await vote(item, 'b')]).toEqual([
        1, 1, 2,
      ]);
      expect(await vote(other, 'a')).toBe(1);

      expectOk(await subject.gate.clearSkipVotes(roomId, item));

      expect(await vote(item, 'c')).toBe(1);
      expect(await vote(other, 'b')).toBe(2);
    });
  });
}
