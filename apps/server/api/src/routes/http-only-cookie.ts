/** A cookie only the server reads, for the whole site; `Secure` whenever the request came over HTTPS. */
export function httpOnlyCookie(
  name: string,
  value: string,
  { maxAgeSeconds, secure }: { maxAgeSeconds: number; secure: boolean }
): string {
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
