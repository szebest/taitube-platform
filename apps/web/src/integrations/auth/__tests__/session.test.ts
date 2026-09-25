import { guestSession } from '../session';

describe('apps/web: session', () => {
  it('renders every page for a guest until the session reaches the server', () => {
    expect(guestSession()).toEqual({ status: 'guest' });
  });
});
