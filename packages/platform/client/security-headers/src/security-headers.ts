import { assertNever } from '@kit/result';
import { createMiddleware } from '@tanstack/react-start';
import { createNonce } from './nonce';

export interface DraftPreviewOptions {
  /** Paths under this prefix are the ones a draft can be previewed on. */
  pathPrefix: string;
  /** The one origin that may frame a preview. */
  framedBy: string;
}

export interface SecurityHeadersOptions {
  /** Paths under this prefix may be framed by any site; every other path may be framed by none. */
  embeddablePrefix?: string;
  /** A request under `pathPrefix` with `?preview=draft` may be framed by `framedBy` and by no one else, and is neither cached nor indexed. */
  draftPreview?: DraftPreviewOptions;
}

type Framing = { kind: 'none' } | { kind: 'any' } | { kind: 'origin'; origin: string };

function frameAncestors(framing: Framing): string {
  switch (framing.kind) {
    case 'none':
      return "'none'";
    case 'any':
      return '*';
    case 'origin':
      return framing.origin;
    default:
      return assertNever(framing, 'Framing');
  }
}

function securityHeaders(nonce: string, framing: Framing): Record<string, string> {
  return {
    'Content-Security-Policy': [
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      `frame-ancestors ${frameAncestors(framing)}`,
      "form-action 'self'",
    ].join('; '),
    ...(framing.kind === 'none' ? { 'X-Frame-Options': 'DENY' } : {}),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

function isDraftPreview(
  { pathPrefix }: DraftPreviewOptions,
  pathname: string,
  { url }: Request
): boolean {
  return pathname.startsWith(pathPrefix) && new URL(url).searchParams.get('preview') === 'draft';
}

export function createSecurityHeadersMiddleware({
  embeddablePrefix,
  draftPreview,
}: SecurityHeadersOptions = {}) {
  return createMiddleware().server(async ({ next, pathname, request }) => {
    const nonce = createNonce();
    const rendered = await next({ context: { nonce } });
    const previewing =
      draftPreview !== undefined && isDraftPreview(draftPreview, pathname, request);
    const embeddable = embeddablePrefix !== undefined && pathname.startsWith(embeddablePrefix);
    const framing: Framing = previewing
      ? { kind: 'origin', origin: draftPreview.framedBy }
      : embeddable
        ? { kind: 'any' }
        : { kind: 'none' };
    for (const [name, value] of Object.entries(securityHeaders(nonce, framing))) {
      rendered.response.headers.set(name, value);
    }
    if (previewing) {
      rendered.response.headers.set('Cache-Control', 'no-store');
      rendered.response.headers.set('X-Robots-Tag', 'noindex');
    }
    return rendered;
  });
}

export const securityHeadersMiddleware = createSecurityHeadersMiddleware();
