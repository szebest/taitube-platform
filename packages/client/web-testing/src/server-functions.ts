import type { createServerFn, execValidator } from '@tanstack/react-start';
import { requestHandler } from '@tanstack/react-start/server';
import { parseSetCookie, serialize } from 'cookie-es';

type Start = { createServerFn: typeof createServerFn; execValidator: typeof execValidator };

type Handler = (options: { data: unknown; context: object }) => unknown;

type Call = (run: () => Promise<unknown>) => Promise<unknown>;

/**
 * The Start compiler turns `createServerFn().handler(fn)` into a call to the server; a spec has no
 * compiler and no Start context, so the builder Start's runtime hands out is kept, and its `handler`
 * runs `fn` through `call`, after the input validator the builder holds.
 */
function serverFunctionsThrough(call: Call, start: Start): typeof createServerFn {
  const keep = <T extends object>(builder: T): T =>
    new Proxy(builder, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver);
        if (property === 'handler') {
          const held: object = target;
          const { inputValidator } = Reflect.get(held, 'options');
          return (handle: Handler) =>
            (options: { data?: unknown } = {}) =>
              call(async () => {
                const data = inputValidator
                  ? await start.execValidator(inputValidator, options.data)
                  : options.data;
                return handle({ data, context: {} });
              });
        }
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => keep(Reflect.apply(value, target, args));
      },
    });
  return (options, internal) => keep(start.createServerFn(options, internal));
}

/** On the server, inside the request a spec renders: the handler reads that request's cookies. */
export function inRenderedRequest(start: Start): typeof createServerFn {
  return serverFunctionsThrough((run) => run(), start);
}

async function inCookieRequest(run: () => Promise<unknown>): Promise<unknown> {
  const ran: { result?: Promise<unknown> } = {};
  const answer = requestHandler(async () => {
    ran.result = run();
    await Promise.allSettled([ran.result]);
    return new Response(null);
  });
  const response = await answer(
    new Request(window.location.href, { headers: { cookie: document.cookie } }),
    {}
  );
  for (const cookie of response.headers.getSetCookie().map((header) => parseSetCookie(header))) {
    if (!cookie) continue;
    const { name, value, httpOnly: _scriptsCannotWriteHttpOnly, ...attributes } = cookie;
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom's jar is where the browser keeps the session cookie.
    document.cookie = serialize(name, value, attributes);
  }
  return ran.result;
}

/**
 * In the browser, a request to the server carrying `document.cookie`, whose `Set-Cookie` lands back
 * in it: jsdom refuses a script setting an httpOnly cookie, so the double drops the flag.
 */
export function overCookieRequest(start: Start): typeof createServerFn {
  return serverFunctionsThrough(inCookieRequest, start);
}
