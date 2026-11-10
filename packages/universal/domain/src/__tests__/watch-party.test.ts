import { defaultAllowGuests } from '../watch-party';

describe('@vp/domain: watch party settings', () => {
  it.each([
    { visibility: 'public' as const, allowed: true },
    { visibility: 'unlisted' as const, allowed: true },
    { visibility: 'private' as const, allowed: false },
  ])('lets guests into a $visibility room by default: $allowed', ({ visibility, allowed }) => {
    expect(defaultAllowGuests(visibility)).toBe(allowed);
  });
});
