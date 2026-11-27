import { type ComposerInput, getComposerState } from '../get-composer-state';

const OPEN: ComposerInput = {
  connected: true,
  chatEnabled: true,
  guest: false,
  canPost: true,
  muted: false,
};

describe('apps/client/web: getComposerState', () => {
  it.each([
    { scenario: 'open for a member who may post', input: {}, state: 'open' },
    {
      scenario: 'offline over everything else',
      input: { connected: false, guest: true },
      state: 'offline',
    },
    { scenario: 'off when the room turned chat off', input: { chatEnabled: false }, state: 'off' },
    { scenario: 'the sign-in bar for a guest', input: { guest: true }, state: 'guest' },
    {
      scenario: 'muted for a muted member',
      input: { muted: true, canPost: false },
      state: 'muted',
    },
    { scenario: 'off for a member who may not post', input: { canPost: false }, state: 'off' },
  ])('is $scenario', ({ input, state }) => {
    expect(getComposerState({ ...OPEN, ...input })).toBe(state);
  });
});
