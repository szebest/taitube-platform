import { clearDirty, markDirty, readDirty } from '../dirty-fields';

describe('apps/client/web: the fields changed while signed out', () => {
  afterEach(() => localStorage.clear());

  it('holds the paths marked, each once, across reads', () => {
    markDirty(['playback.speed']);
    markDirty(['playback.speed', 'appearance.mode']);

    expect([...readDirty()]).toEqual(['playback.speed', 'appearance.mode']);
  });

  it('clears them', () => {
    markDirty(['playback.speed']);
    clearDirty();

    expect(readDirty().size).toBe(0);
    expect(localStorage.getItem('vp.prefs.dirty')).toBeNull();
  });

  it.each(['{', '{"a":1}', '[1]'])('reads damaged storage %j as none', (raw) => {
    localStorage.setItem('vp.prefs.dirty', raw);

    expect(readDirty().size).toBe(0);
  });

  it('reads storage that refuses as none, and marks nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    markDirty(['playback.speed']);

    expect(readDirty().size).toBe(0);
  });
});
