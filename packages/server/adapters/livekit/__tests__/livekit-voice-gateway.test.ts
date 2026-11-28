import { createHash } from 'node:crypto';
import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import {
  AccessToken,
  ServerError,
  TokenVerifier,
  TrackSource,
  TrackType,
} from 'livekit-server-sdk';
import { describeVoiceGatewayContract } from '../../__tests__/contract/voice-gateway.contract';
import { LiveKitVoiceGateway, type VoiceRoomsClient } from '../livekit-voice-gateway';

const KEY = 'test-key';
const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
const ROOM = 'party:1';

function fakeRooms(overrides: Partial<VoiceRoomsClient> = {}): VoiceRoomsClient {
  return {
    listRooms: async () => [],
    listParticipants: async () => [],
    updateParticipant: async () => ({}),
    mutePublishedTrack: async () => ({}),
    removeParticipant: async () => ({}),
    ...overrides,
  };
}

function gatewayOver(rooms: VoiceRoomsClient) {
  return new LiveKitVoiceGateway({ type: 'client', rooms, apiKey: KEY, apiSecret: SECRET });
}

async function signed(body: string): Promise<string> {
  const token = new AccessToken(KEY, SECRET);
  token.sha256 = createHash('sha256').update(body).digest('base64');
  return token.toJwt();
}

describeVoiceGatewayContract(async () => ({
  gateway: gatewayOver(fakeRooms()),
  sign: signed,
  close: async () => {},
}));

const notFound = () => new ServerError('not_found', 'no such room', 404);

describe('adapters/livekit: LiveKitVoiceGateway', () => {
  it('mints a token that carries the grants, the identity and an audio-only publish source', async () => {
    const gateway = gatewayOver(fakeRooms());
    const jwt = expectOk(
      await gateway.mintToken({
        room: ROOM,
        identity: 'user:a',
        name: 'Ana',
        grants: { canSubscribe: true, canPublish: false },
        ttlSeconds: 600,
      })
    );

    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt);

    expect(claims).toMatchObject({
      sub: 'user:a',
      name: 'Ana',
      metadata: JSON.stringify({ speak: false }),
      video: {
        room: ROOM,
        roomJoin: true,
        canSubscribe: true,
        canPublish: false,
        canPublishData: false,
        canPublishSources: ['microphone'],
      },
    });
  });

  it.each([
    { canPublish: true, sources: [TrackSource.MICROPHONE] },
    { canPublish: false, sources: [] },
  ])(
    'replaces the permission with canPublish=$canPublish in one call',
    async ({ canPublish, sources }) => {
      const updateParticipant = vi.fn<VoiceRoomsClient['updateParticipant']>(async () => ({}));
      const gateway = gatewayOver(fakeRooms({ updateParticipant }));

      expectOk(await gateway.updateParticipant(ROOM, 'user:a', { canSubscribe: true, canPublish }));

      expect(updateParticipant).toHaveBeenCalledWith(ROOM, 'user:a', {
        permission: {
          canSubscribe: true,
          canPublish,
          canPublishData: false,
          canPublishSources: sources,
        },
      });
    }
  );

  it('mutes every audio track of the participant and no other', async () => {
    const mutePublishedTrack = vi.fn<VoiceRoomsClient['mutePublishedTrack']>(async () => ({}));
    const gateway = gatewayOver(
      fakeRooms({
        listParticipants: async () =>
          [
            {
              identity: 'user:a',
              tracks: [
                { sid: 'TR_audio', type: TrackType.AUDIO },
                { sid: 'TR_video', type: TrackType.VIDEO },
              ],
            },
            { identity: 'user:b', tracks: [{ sid: 'TR_other', type: TrackType.AUDIO }] },
          ] as Awaited<ReturnType<VoiceRoomsClient['listParticipants']>>,
        mutePublishedTrack,
      })
    );

    expectOk(await gateway.muteTrack(ROOM, 'user:a', true));

    expect(mutePublishedTrack.mock.calls).toEqual([[ROOM, 'user:a', 'TR_audio', true]]);
  });

  it('lists who is in the room with their grants and whether they publish', async () => {
    const gateway = gatewayOver(
      fakeRooms({
        listParticipants: async () =>
          [
            {
              identity: 'user:a',
              metadata: JSON.stringify({ speak: true }),
              permission: { canSubscribe: true, canPublish: true },
              tracks: [{ sid: 'TR_a', type: TrackType.AUDIO }],
            },
            { identity: 'user:b', tracks: [] },
          ] as Awaited<ReturnType<VoiceRoomsClient['listParticipants']>>,
      })
    );

    expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([
      {
        identity: 'user:a',
        grants: { canSubscribe: true, canPublish: true },
        publishing: true,
        wantsToSpeak: true,
      },
      {
        identity: 'user:b',
        grants: { canSubscribe: false, canPublish: false },
        publishing: false,
        wantsToSpeak: false,
      },
    ]);
  });

  it('treats a room or participant the server does not know as success and empty', async () => {
    const missing = vi.fn(async () => {
      throw notFound();
    });
    const gateway = gatewayOver(
      fakeRooms({
        listParticipants: missing,
        updateParticipant: missing,
        removeParticipant: missing,
      })
    );

    expect(expectOk(await gateway.listParticipants(ROOM))).toEqual([]);
    expectOk(
      await gateway.updateParticipant(ROOM, 'user:a', { canSubscribe: true, canPublish: false })
    );
    expectOk(await gateway.removeParticipant(ROOM, 'user:a'));
  });

  it('reports a server that does not answer as unavailable, with the operation', async () => {
    const down = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const gateway = gatewayOver(fakeRooms({ listRooms: down, removeParticipant: down }));

    expect(expectErr(await gateway.checkHealth())).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE,
      operation: 'health',
    });
    expect(expectErr(await gateway.removeParticipant(ROOM, 'user:a'))).toMatchObject({
      operation: 'remove',
    });
  });
});
