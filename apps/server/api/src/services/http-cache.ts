import * as crypto from 'node:crypto';

export interface CacheControlOptions {
  etag?: string;
  maxAgeSeconds?: number;
  isPublic?: boolean;
  staleWhileRevalidateSeconds?: number;
  mustRevalidate?: boolean;
}

export function generateEtag(data: unknown, weak = true): string {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
  return weak ? `W/"${hash}"` : `"${hash}"`;
}

function normalizeEtag(tag: string): string {
  return tag.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
}

/** Weak and strong forms of one tag match, as RFC 9110 §13.1.2 prescribes for If-None-Match. */
export function isNotModified(ifNoneMatch?: string | null, currentEtag?: string | null): boolean {
  if (!(ifNoneMatch && currentEtag)) return false;
  if (ifNoneMatch.trim() === '*') return true;

  const target = normalizeEtag(currentEtag);
  if (!target) return false;

  return ifNoneMatch.split(',').map(normalizeEtag).includes(target);
}

export function buildCacheHeaders(options: CacheControlOptions): Record<string, string> {
  const directives = [options.isPublic === false ? 'private' : 'public'];

  if (typeof options.maxAgeSeconds === 'number') {
    directives.push(`max-age=${Math.max(0, options.maxAgeSeconds)}`);
  }
  if (typeof options.staleWhileRevalidateSeconds === 'number') {
    directives.push(`stale-while-revalidate=${Math.max(0, options.staleWhileRevalidateSeconds)}`);
  }
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return {
    'Cache-Control': directives.join(', '),
    ...(options.etag ? { ETag: options.etag } : {}),
  };
}
