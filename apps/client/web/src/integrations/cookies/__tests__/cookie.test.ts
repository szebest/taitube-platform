import { requestHandler } from '@tanstack/react-start/server';
import { readCookie } from '../cookie';

async function readDuringRequest(cookie: string, name: string): Promise<string> {
  const answer = requestHandler(async () => new Response(readCookie(name) ?? '(none)'));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.text();
}

describe('apps/client/web: cookie on the server', () => {
  it.each([
    { cookie: 'vp.theme=light; other=1', name: 'vp.theme', value: 'light' },
    { cookie: 'other=1', name: 'vp.theme', value: '(none)' },
  ])(
    'reads $name from the request the server is answering: $value',
    async ({ cookie, name, value }) => {
      expect(await readDuringRequest(cookie, name)).toBe(value);
    }
  );
});
