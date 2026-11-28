import type { CookieJar } from '../tokens';

export type MakeCookieJar = (held: Readonly<Record<string, string>>) => CookieJar;

export function describeCookieJarContract(makeCookieJar: MakeCookieJar): void {
  describe('CookieJar contract', () => {
    it.each([
      { name: 'theme', value: 'sand' },
      { name: 'empty', value: '' },
    ])('reads the cookie $name back as it was held', async ({ name, value }) => {
      const jar = makeCookieJar({ [name]: value });

      expect(await jar.get(name)).toBe(value);
    });

    it('resolves undefined, never rejects, for a cookie nobody set', async () => {
      const jar = makeCookieJar({ theme: 'sand' });

      expect(await jar.get('missing')).toBeUndefined();
    });

    it('tells two cookies apart', async () => {
      const jar = makeCookieJar({ theme: 'sand', locale: 'fi-FI' });

      expect([await jar.get('theme'), await jar.get('locale')]).toEqual(['sand', 'fi-FI']);
    });
  });
}
