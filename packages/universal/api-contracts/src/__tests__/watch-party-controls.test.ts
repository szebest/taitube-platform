import { putWatchPartyControl } from '../watch-party-controls';

describe('packages/api-contracts: personal controls', () => {
  it.each([
    {
      scenario: 'a room-scoped mute',
      body: {
        targetKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        roomId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        voiceMuted: true,
      },
      ok: true,
    },
    {
      scenario: 'blocking invites everywhere',
      body: {
        targetKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        roomId: null,
        blockInvites: true,
      },
      ok: true,
    },
    {
      scenario: 'blocking invites in one room',
      body: {
        targetKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        roomId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        blockInvites: true,
      },
      ok: false,
    },
    {
      scenario: 'a volume above 200',
      body: { targetKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', roomId: null, volume: 201 },
      ok: false,
    },
    {
      scenario: 'no scope',
      body: { targetKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', favourite: true },
      ok: false,
    },
  ])('takes $scenario: $ok', ({ body, ok }) => {
    expect(putWatchPartyControl.body.safeParse(body).success).toBe(ok);
  });
});
