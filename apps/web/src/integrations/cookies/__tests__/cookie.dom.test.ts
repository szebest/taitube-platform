import { readCookie, writeCookie } from '../cookie';

describe('apps/web: cookie in the browser', () => {
  afterEach(() => {
    writeCookie('vp.theme', '', { maxAge: 0 });
  });

  it('reads back the cookie it wrote for the whole site', () => {
    writeCookie('vp.theme', 'light', { maxAge: 60 });

    expect(readCookie('vp.theme')).toBe('light');
    expect(readCookie('other')).toBeUndefined();
  });

  it('writes a site-wide, same-site lax cookie that lasts maxAge seconds', () => {
    const set = vi.spyOn(document, 'cookie', 'set');

    writeCookie('vp.theme', 'dark', { maxAge: 60 });

    expect(set).toHaveBeenCalledWith('vp.theme=dark; Max-Age=60; Path=/; SameSite=Lax');
  });
});
