import { takeLegacyLocale } from '../device-preferences';

describe('apps/client/web: the locale kept before the store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hands over the old key once, and removes it', () => {
    localStorage.setItem('vp.locale', 'sv-FI');

    expect(takeLegacyLocale()).toBe('sv-FI');
    expect(localStorage.getItem('vp.locale')).toBeNull();
    expect(takeLegacyLocale()).toBeUndefined();
  });

  it('finds nothing in a value that is not a language tag', () => {
    localStorage.setItem('vp.locale', 'x');

    expect(takeLegacyLocale()).toBeUndefined();
  });

  it('finds nothing when storage refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(takeLegacyLocale()).toBeUndefined();
  });
});
