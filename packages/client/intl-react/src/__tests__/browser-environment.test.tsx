import { readBrowserEnvironment } from '../browser-environment';

describe('@vp/intl-react: readBrowserEnvironment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads the saved locale, the browser's languages, its zone and the time", () => {
    localStorage.setItem('vp.locale', 'sv-FI');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-AT', 'en']);

    const environment = readBrowserEnvironment();

    expect(environment.persistedLocale).toBe('sv-FI');
    expect(environment.languages).toEqual(['de-AT', 'en']);
    expect(environment.timeZone).not.toBe('');
    expect(Number.isNaN(Date.parse(environment.now))).toBe(false);
  });

  it('reports no saved locale when there is none', () => {
    expect(readBrowserEnvironment().persistedLocale).toBeUndefined();
  });

  it('reports no saved locale when storage refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(readBrowserEnvironment().persistedLocale).toBeUndefined();
  });
});
