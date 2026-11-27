import { isWatchPartyPermission } from '../watch-party-permissions';

describe('@vp/domain: the room permission registry', () => {
  it.each([
    { value: 'chat.post', known: true },
    { value: 'room.lights', known: false },
  ])('knows $value: $known', ({ value, known }) => {
    expect(isWatchPartyPermission(value)).toBe(known);
  });
});
