import {
  NO_PERSONAL_CONTROL,
  type PersonalControl,
  controlsForRoom,
  isNoPersonalControl,
  resolvePersonalControl,
} from '../watch-party-personal-controls';

function controlOf(overrides: Partial<PersonalControl> = {}): PersonalControl {
  return { ...NO_PERSONAL_CONTROL, targetKey: 'user:tom', roomId: null, ...overrides };
}

describe('@vp/domain: personal controls', () => {
  const everywhere = controlOf({ hideMessages: true, blockInvites: true, volume: 50 });
  const inRoomA = controlOf({
    roomId: 'room-a',
    hideReactions: true,
    blockInvites: true,
    volume: 150,
  });
  const inRoomB = controlOf({ roomId: 'room-b', favourite: true });

  it('returns a room-scoped control only for its room, an everywhere one for every room', () => {
    expect(controlsForRoom([everywhere, inRoomA, inRoomB], 'room-a')).toEqual([
      everywhere,
      inRoomA,
    ]);
  });

  it.each([
    {
      scenario: 'in room A',
      roomId: 'room-a',
      expected: { hideMessages: true, hideReactions: true, favourite: false, volume: 150 },
    },
    {
      scenario: 'in room B',
      roomId: 'room-b',
      expected: { hideMessages: true, hideReactions: false, favourite: true, volume: 50 },
    },
    { scenario: 'outside any room', roomId: null, expected: { hideReactions: false, volume: 50 } },
  ])('merges both scopes $scenario', ({ roomId, expected }) => {
    expect(
      resolvePersonalControl([everywhere, inRoomA, inRoomB], 'user:tom', roomId)
    ).toMatchObject(expected);
  });

  it.each([
    { scenario: 'everywhere', controls: [everywhere], blocked: true },
    { scenario: 'in one room only', controls: [inRoomA], blocked: false },
  ])('blocks invites when set $scenario: $blocked', ({ controls, blocked }) => {
    expect(resolvePersonalControl(controls, 'user:tom', 'room-a').blockInvites).toBe(blocked);
  });

  it.each([
    { scenario: 'nothing chosen', values: NO_PERSONAL_CONTROL, empty: true },
    { scenario: 'a volume', values: { ...NO_PERSONAL_CONTROL, volume: 80 }, empty: false },
    { scenario: 'a flag', values: { ...NO_PERSONAL_CONTROL, favourite: true }, empty: false },
  ])('treats $scenario as no control: $empty', ({ values, empty }) => {
    expect(isNoPersonalControl(values)).toBe(empty);
  });
});
