import { readCookie, writeCookie } from '../cookie';

describe('@vp/ui: cookie in the browser', () => {
  afterEach(() => {
    writeCookie('vp.theme', '', { maxAge: 0 });
  });

  it('reads back the cookie it wrote for the whole site', () => {
    writeCookie('vp.theme', 'light', { maxAge: 60 });

    expect(readCookie('vp.theme')).toBe('light');
    expect(readCookie('other')).toBeUndefined();
  });

  it.each([
    { scope: 'this host', domain: undefined, written: 'vp.theme=dark; Max-Age=60; Path=/; SameSite=Lax' },
    {
      scope: 'a shared parent domain',
      domain: 'taitube.local',
      written: 'vp.theme=dark; Max-Age=60; Domain=taitube.local; Path=/; SameSite=Lax',
    },
  ])('writes a site-wide, same-site lax cookie for $scope that lasts maxAge seconds', ({ domain, written }) => {
    const set = vi.spyOn(document, 'cookie', 'set');

    writeCookie('vp.theme', 'dark', { maxAge: 60, domain });

    expect(set).toHaveBeenCalledWith(written);
  });
});
