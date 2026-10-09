import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';
import { parse, serialize } from 'cookie-es';

export const readCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name))
  .client((name: string) => parse(document.cookie)[name]);

export function writeCookie(name: string, value: string, { maxAge }: { maxAge: number }): void {
  document.cookie = serialize(name, value, { maxAge, path: '/', sameSite: 'lax' });
}
