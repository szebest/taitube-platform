import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';
import { tryCatch, unwrapOr } from '@vp/result';
import { parse, serialize } from 'cookie-es';

/**
 * The server reads the request it is answering; outside one (a spec, which runs this module
 * uncompiled) there is no cookie to read.
 */
export const readCookie = createIsomorphicFn()
  .server((name: string) =>
    unwrapOr(
      tryCatch(
        () => getCookie(name),
        (cause) => cause
      ),
      undefined
    )
  )
  .client((name: string) => parse(document.cookie)[name]);

export function writeCookie(name: string, value: string, { maxAge }: { maxAge: number }): void {
  document.cookie = serialize(name, value, { maxAge, path: '/', sameSite: 'lax' });
}
