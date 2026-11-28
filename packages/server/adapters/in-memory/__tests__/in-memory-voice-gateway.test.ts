import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { inMemoryVoiceGatewaySubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeVoiceGatewayContract } from '../../__tests__/contract/voice-gateway.contract';
import { InMemoryVoiceGateway } from '../in-memory-voice-gateway';

describeVoiceGatewayContract(inMemoryVoiceGatewaySubject);

const ROOM = 'party:1';
const SECRET = 'twin-secret';
const SPEAKER = { canSubscribe: true, canPublish: true };

async function joined(gateway: InMemoryVoiceGateway, grants = SPEAKER) {
  const token = expectOk(
    await gateway.mintToken({
      room: ROOM,
      identity: 'user:a',
      name: 'Ana',
      grants,
      ttlSeconds: 600,
    })
  );
  gateway.join(token);
}

describe('adapters/in-memory: InMemoryVoiceGateway', () => {
  it('lets a participant publish until the server drops the grant', async () => {
    const gateway = new InMemoryVoiceGateway(SECRET);
    await joined(gateway);

    expect(gateway.publish(ROOM, 'user:a')).toBe(true);
    expectOk(await gateway.updateParticipant(ROOM, 'user:a', { ...SPEAKER, canPublish: false }));

    expect(gateway.publish(ROOM, 'user:a')).toBe(false);
    expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([
      {
        identity: 'user:a',
        grants: { canSubscribe: true, canPublish: false },
        publishing: false,
        wantsToSpeak: true,
      },
    ]);
  });

  it('refuses a forged publish from a listener', async () => {
    const gateway = new InMemoryVoiceGateway(SECRET);
    await joined(gateway, { canSubscribe: true, canPublish: false });

    expect(gateway.publish(ROOM, 'user:a')).toBe(false);
  });

  it('mutes a publishing track and disconnects a removed participant', async () => {
    const gateway = new InMemoryVoiceGateway(SECRET);
    await joined(gateway);
    gateway.publish(ROOM, 'user:a');

    expectOk(await gateway.muteTrack(ROOM, 'user:a', true));
    expect(gateway.isMuted(ROOM, 'user:a')).toBe(true);
    expectOk(await gateway.removeParticipant(ROOM, 'user:a'));

    expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([]);
    expect(gateway.removed).toEqual([{ room: ROOM, identity: 'user:a' }]);
  });

  it('reads the events it signed', async () => {
    const gateway = new InMemoryVoiceGateway(SECRET);
    const { body, authorization } = gateway.sign({
      type: 'participant_left',
      room: ROOM,
      identity: 'user:a',
    });

    expect(expectOk(await gateway.verifyWebhook(body, authorization))).toEqual({
      type: 'participant_left',
      room: ROOM,
      identity: 'user:a',
    });
    expect(
      expectErr(await gateway.verifyWebhook('not json', gateway.signBody('not json'))).code
    ).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('answers unavailable while told to, and forgets everything on clear', async () => {
    const gateway = new InMemoryVoiceGateway(SECRET);
    await joined(gateway);
    gateway.setUnavailable(true);

    expect(expectErr(await gateway.checkHealth()).code).toBe(
      ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE
    );
    gateway.clear();

    expectOk(await gateway.checkHealth());
    expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([]);
  });
});
