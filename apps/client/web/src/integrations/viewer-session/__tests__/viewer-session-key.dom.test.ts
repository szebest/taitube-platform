import { viewerSessionKey } from '../viewer-session-key';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('apps/client/web: viewerSessionKey', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('makes a random key once and keeps it for the tab', () => {
    const first = viewerSessionKey();

    expect(first).toMatch(UUID);
    expect(viewerSessionKey()).toBe(first);
    expect(document.cookie).toBe('');
  });

  it('replaces a stored value that is not a key', () => {
    window.sessionStorage.setItem('vp.viewer-session', 'tampered');

    expect(viewerSessionKey()).toMatch(UUID);
  });

  it('still answers a key when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(viewerSessionKey()).toMatch(UUID);
  });
});
