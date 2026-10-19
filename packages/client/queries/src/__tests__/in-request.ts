import { requestHandler } from '@tanstack/react-start/server';

type RequestOptions = { cookie?: string; url?: string };

/** Runs server code inside a request the way the app's server answers one, and returns its cookies. */
export async function inRequest<T>(
  run: () => Promise<T> | T,
  { cookie = '', url = 'http://localhost:5173/' }: RequestOptions = {}
): Promise<{ value: T; setCookies: string[] }> {
  const ran: { result?: Promise<T> } = {};
  const answer = requestHandler(async () => {
    ran.result = Promise.resolve().then(run);
    await ran.result.catch(() => undefined);
    return new Response(null);
  });
  const response = await answer(new Request(url, { headers: { cookie } }), {});
  if (!ran.result) throw new Error('the request never ran the code under test');
  return { value: await ran.result, setCookies: response.headers.getSetCookie() };
}
