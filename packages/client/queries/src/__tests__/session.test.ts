import { guestSession } from '../session';

describe('@vp/queries: session', () => {
  it('renders every page for a guest until the session reaches the server', () => {
    expect(guestSession()).toEqual({ status: 'guest' });
  });
});
