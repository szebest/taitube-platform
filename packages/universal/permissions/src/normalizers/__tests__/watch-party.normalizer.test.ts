import { toWatchPartyViewer } from '../watch-party.normalizer';

describe('normalizers/watch-party: the viewer inside a room', () => {
  it("takes a seat's effective permissions and position", () => {
    const seat = {
      kind: 'user' as const,
      isOwner: false,
      effective: { permissions: ['chat.post' as const], topPosition: 400 },
    };

    expect(toWatchPartyViewer(seat)).toEqual({
      permissions: ['chat.post'],
      topPosition: 400,
      isOwner: false,
      kind: 'user',
    });
  });

  it('gives a caller without a seat nothing and a position below Guest', () => {
    expect(toWatchPartyViewer(null)).toEqual({
      permissions: [],
      topPosition: -1,
      isOwner: false,
      kind: null,
    });
  });
});
