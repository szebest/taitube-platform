import { readCookie, writeCookie } from '../cookie';

describe('@kit/ui: cookie in the browser', () => {
  afterEach(() => {
    writeCookie('acme.theme', '', { maxAge: 0 });
  });

  it('reads back the cookie it wrote for the whole site', () => {
    writeCookie('acme.theme', 'light', { maxAge: 60 });

    expect(readCookie('acme.theme')).toBe('light');
    expect(readCookie('other')).toBeUndefined();
  });

  it.each([
    {
      scope: 'this host',
      domain: undefined,
      written: 'acme.theme=dark; Max-Age=60; Path=/; SameSite=Lax',
    },
    {
      scope: 'a shared parent domain',
      domain: 'acme.local',
      written: 'acme.theme=dark; Max-Age=60; Domain=acme.local; Path=/; SameSite=Lax',
    },
  ])(
    'writes a site-wide, same-site lax cookie for $scope that lasts maxAge seconds',
    ({ domain, written }) => {
      const set = vi.spyOn(document, 'cookie', 'set');

      writeCookie('acme.theme', 'dark', { maxAge: 60, domain });

      expect(set).toHaveBeenCalledWith(written);
    }
  );
});
