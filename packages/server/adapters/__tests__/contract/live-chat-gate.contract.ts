import { randomUUID } from 'node:crypto';
import type { LiveChatGatePort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface LiveChatGateSubject {
  readonly gate: LiveChatGatePort;
  close(): Promise<void>;
}

const RULES = { slowModeSeconds: 0, burst: { messages: 3, windowSeconds: 10 } };

export function describeLiveChatGateContract(makeSubject: () => Promise<LiveChatGateSubject>) {
  describe('LiveChatGate contract', () => {
    let subject: LiveChatGateSubject;
    let streamId: string;
    let userId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      streamId = randomUUID();
      userId = randomUUID();
    });

    const admit = async (rules = RULES, user = userId) =>
      expectOk(await subject.gate.admit(streamId, user, rules));

    it('redeems a one-time token once', async () => {
      const ticket = randomUUID();
      const grant = { userId, role: 'USER' as const, liveStreamId: streamId };
      expectOk(await subject.gate.issueTicket(ticket, grant, 30));

      expect(expectOk(await subject.gate.redeemTicket(ticket))).toEqual(grant);
      expect(expectOk(await subject.gate.redeemTicket(ticket))).toBeNull();
      expect(expectOk(await subject.gate.redeemTicket(randomUUID()))).toBeNull();
    });

    it('admits a burst and refuses the line after it, for that sender only', async () => {
      for (const _ of [1, 2, 3]) expect(await admit()).toEqual({ type: 'admitted' });

      const refused = await admit();

      expect(refused).toMatchObject({ type: 'refused' });
      expect(refused.type === 'refused' && refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(await admit(RULES, randomUUID())).toEqual({ type: 'admitted' });
    });

    it('holds a sender to slow mode', async () => {
      const slow = { ...RULES, slowModeSeconds: 30 };

      expect(await admit(slow)).toEqual({ type: 'admitted' });
      const refused = await admit(slow);

      expect(refused).toMatchObject({ type: 'refused' });
      expect(refused.type === 'refused' && refused.retryAfterSeconds).toBeLessThanOrEqual(30);
    });
  });
}
