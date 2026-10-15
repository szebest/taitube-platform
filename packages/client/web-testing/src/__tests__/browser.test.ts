import { stubBrowser } from '../browser';

describe('@vp/web-testing: stubBrowser', () => {
  it('serves what the spec stored and keeps what the page stores, where the spec can read it', () => {
    const storage = stubBrowser({ SIDEBAR: 'true' });

    window.localStorage.setItem('THEME', 'dark');
    window.localStorage.removeItem('SIDEBAR');

    expect(window.localStorage.getItem('THEME')).toBe('dark');
    expect(window.localStorage.getItem('SIDEBAR')).toBeNull();
    expect([...storage.entries()]).toEqual([['THEME', 'dark']]);
  });

  it('accepts the storage event listeners a hook registers, without firing them', () => {
    stubBrowser();
    const listener = vi.fn();

    window.addEventListener('storage', listener);
    window.dispatchEvent(new Event('storage'));
    window.removeEventListener('storage', listener);

    expect(listener).not.toHaveBeenCalled();
  });
});
