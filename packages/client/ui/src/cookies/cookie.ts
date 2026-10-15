import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie } from '@tanstack/react-start/server';
import { parse, serialize } from 'cookie-es';

export const readCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name))
  .client((name: string) => parse(document.cookie)[name]);

export type CookieOptions = {
  maxAge: number;
  /** The parent domain both apps share in cloud, so the cookie follows the user between them; unset locally. */
  domain?: string;
};

export function writeCookie(name: string, value: string, { maxAge, domain }: CookieOptions): void {
  // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is async and jsdom, where the dom specs run, has none.
  document.cookie = serialize(name, value, { maxAge, domain, path: '/', sameSite: 'lax' });
}
