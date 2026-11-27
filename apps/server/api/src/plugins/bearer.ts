import { isApiTokenCredential } from '@vp/domain';

const BEARER = /^Bearer (.+)$/;

/** The credential of an `Authorization: Bearer` header; `null` for any other header or none. */
export function bearerOf(header: string | undefined): string | null {
  return (header && BEARER.exec(header)?.[1]?.trim()) || null;
}

/** Whether the request presents a personal access token, well formed or not. */
export function carriesApiToken(header: string | undefined): boolean {
  const credential = bearerOf(header);
  return credential !== null && isApiTokenCredential(credential);
}
