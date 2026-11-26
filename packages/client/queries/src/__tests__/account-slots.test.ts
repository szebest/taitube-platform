import { appLink, identityKey, identityPath, parseIdentityPath, parseSlot } from '../account-slots';

describe('@vp/queries: account slots', () => {
  it.each([
    { path: '/watch/abc', identity: undefined, pathname: '/watch/abc' },
    { path: '/u/2/watch/abc', identity: { slot: 2 }, pathname: '/watch/abc' },
    { path: '/u/2', identity: { slot: 2 }, pathname: '/' },
    {
      path: '/u/1/c/second.chan/studio/videos',
      identity: { slot: 1, channel: 'second.chan' },
      pathname: '/studio/videos',
    },
    { path: '/u/12/watch', identity: undefined, pathname: '/u/12/watch' },
    { path: '/users/2', identity: undefined, pathname: '/users/2' },
    { path: '/u/0/c/%E0%A4%A/watch', identity: undefined, pathname: '/u/0/c/%E0%A4%A/watch' },
  ])('reads $path as $identity on $pathname', ({ path, identity, pathname }) => {
    expect(parseIdentityPath(path)).toEqual({ identity, pathname });
  });

  it.each([
    { identity: undefined, pathname: '/watch/abc', expected: '/watch/abc' },
    { identity: { slot: 3 }, pathname: '/watch/abc', expected: '/u/3/watch/abc' },
    { identity: { slot: 3 }, pathname: '/', expected: '/u/3' },
    { identity: { slot: 0, channel: 'mine' }, pathname: '/x', expected: '/u/0/c/mine/x' },
    { identity: { slot: 3 }, pathname: '/login', expected: '/login' },
  ])('puts $pathname under $identity: $expected', ({ identity, pathname, expected }) => {
    expect(identityPath(identity, pathname)).toBe(expected);
    expect(parseIdentityPath(expected).pathname).toBe(pathname);
  });

  it.each([
    { value: '4', slot: 4 },
    { value: '10', slot: undefined },
    { value: '-1', slot: undefined },
    { value: 'one', slot: undefined },
    { value: null, slot: undefined },
  ])('reads the slot $value as $slot', ({ value, slot }) => {
    expect(parseSlot(value)).toBe(slot);
  });

  it('keys an identity by its slot and its channel', () => {
    expect([identityKey({ slot: 1 }), identityKey({ slot: 1, channel: 'two' })]).toEqual([
      '1.primary',
      '1.two',
    ]);
  });

  it.each([
    {
      tab: { identity: { slot: 0 }, prefixed: false },
      expected: 'http://localhost:5174/upload?draft=1',
    },
    {
      tab: { identity: { slot: 2, channel: 'two' }, prefixed: true },
      expected: 'http://localhost:5174/u/2/c/two/upload?draft=1',
    },
    {
      tab: { identity: { slot: 0 }, prefixed: false },
      path: '/',
      expected: 'http://localhost:5174',
    },
    {
      tab: { identity: { slot: 3 }, prefixed: true },
      path: '/',
      expected: 'http://localhost:5174/u/3',
    },
  ])('links into the other app from $tab', ({ tab, path = '/upload?draft=1', expected }) => {
    expect(appLink('http://localhost:5174', path, tab)).toBe(expected);
  });
});
