import { expectErr, expectOk } from '@kit/testing/result';
import type { VoiceGatewayPort } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';

export interface VoiceGatewaySubject {
  readonly gateway: VoiceGatewayPort;
  /** A body and `Authorization` header the media server's own key vouches for. */
  sign(body: string): Promise<string>;
  close(): Promise<void>;
}

const GRANTS = { canSubscribe: true, canPublish: false };
const ROOM = 'party:contract-nobody-joined';

export function describeVoiceGatewayContract(makeSubject: () => Promise<VoiceGatewaySubject>) {
  describe('VoiceGateway contract', () => {
    let subject: VoiceGatewaySubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    it('answers a health check', async () => {
      expectOk(await subject.gateway.checkHealth());
    });

    it('mints a token for a room', async () => {
      const token = expectOk(
        await subject.gateway.mintToken({
          room: ROOM,
          identity: 'user:a',
          name: 'Ana',
          grants: GRANTS,
          ttlSeconds: 600,
        })
      );

      expect(token.length).toBeGreaterThan(0);
    });

    it('finds nobody in a room nobody joined, and has nothing to change there', async () => {
      const { gateway } = subject;

      expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([]);
      expectOk(await gateway.updateParticipant(ROOM, 'user:a', GRANTS));
      expectOk(await gateway.muteTrack(ROOM, 'user:a', true));
      expectOk(await gateway.removeParticipant(ROOM, 'user:a'));
    });

    it('reads a signed participant event', async () => {
      const body = JSON.stringify({
        event: 'participant_joined',
        room: { name: ROOM },
        participant: { identity: 'user:a', permission: { canPublish: true } },
      });

      const event = expectOk(await subject.gateway.verifyWebhook(body, await subject.sign(body)));

      expect(event).toEqual({
        type: 'participant_joined',
        room: ROOM,
        identity: 'user:a',
        canPublish: true,
      });
    });

    it('refuses a body its signature does not vouch for', async () => {
      const body = JSON.stringify({ event: 'participant_left' });
      const signature = await subject.sign(body);

      const refused = expectErr(await subject.gateway.verifyWebhook(`${body} `, signature));

      expect(refused.code).toBe(ErrorCodes.UNAUTHORIZED);
      expectErr(await subject.gateway.verifyWebhook(body, undefined));
    });
  });
}
