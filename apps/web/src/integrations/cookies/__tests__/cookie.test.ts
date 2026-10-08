import { requestHandler } from '@tanstack/react-start/server';
import { readCookie, writeCookie } from '../cookie';

async function readDuringRequest(cookie: string, name: string): Promise<string> {
  const answer = requestHandler(async () => new Response(readCookie(name) ?? '(none)'));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.text();
}

describe('apps/web: cookie', () => {
  it.each([
    { cookie: 'vp.theme=light; other=1', name: 'vp.theme', value: 'light' },
    { cookie: 'other=1', name: 'vp.theme', value: '(none)' },
  ])(
    'reads $name from the request the server is answering: $value',
    async ({ cookie, name, value }) => {
      expect(await readDuringRequest(cookie, name)).toBe(value);
    }
  );

  it('reads nothing outside a request', () => {
    expect(readCookie('vp.theme')).toBeUndefined();
  });

  it('writes a cookie the browser keeps for the whole site', () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    writeCookie('vp.theme', 'light', { maxAge: 60 });

    expect(document.cookie).toBe('vp.theme=light; Max-Age=60; Path=/; SameSite=Lax');
  });
});
