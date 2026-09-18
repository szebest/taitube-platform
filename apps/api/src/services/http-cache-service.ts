import * as crypto from 'node:crypto';

export interface CacheControlOptions {
  etag?: string;
  maxAgeSeconds?: number;
  isPublic?: boolean;
  staleWhileRevalidateSeconds?: number;
  mustRevalidate?: boolean;
}

/**
 * HttpCacheService — Generalized HTTP caching, ETag generation, conditional request evaluation,
 * and Cache-Control header construction. Reusable across multiple domain services.
 */
export class HttpCacheService {
  /**
   * Generates a deterministic ETag from any serializable object or string.
   */
  generateEtag(data: unknown, weak = true): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
    return weak ? `W/"${hash}"` : `"${hash}"`;
  }

  /**
   * Evaluates If-None-Match conditional header against the resource's current ETag.
   * Handles weak prefixes (W/), quotes, and comma-separated multiple client tokens.
   */
  isNotModified(ifNoneMatch?: string | null, currentEtag?: string | null): boolean {
    if (!(ifNoneMatch && currentEtag)) {
      return false;
    }

    // Wildcard match
    if (ifNoneMatch.trim() === '*') {
      return true;
    }

    const normalize = (tag: string): string => tag.trim().replace(/^W\//, '').replace(/^"|"$/g, '');

    const target = normalize(currentEtag);
    if (!target) {
      return false;
    }

    const clientTags = ifNoneMatch.split(',').map(normalize);
    return clientTags.includes(target);
  }

  /**
   * Builds standardized Cache-Control and ETag headers.
   */
  buildCacheHeaders(options: CacheControlOptions): Record<string, string> {
    const headers: Record<string, string> = {};

    const directives: string[] = [];
    directives.push(options.isPublic !== false ? 'public' : 'private');

    if (typeof options.maxAgeSeconds === 'number') {
      directives.push(`max-age=${Math.max(0, options.maxAgeSeconds)}`);
    }

    if (typeof options.staleWhileRevalidateSeconds === 'number') {
      directives.push(`stale-while-revalidate=${Math.max(0, options.staleWhileRevalidateSeconds)}`);
    }

    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (directives.length > 0) {
      headers['Cache-Control'] = directives.join(', ');
    }

    if (options.etag) {
      headers['ETag'] = options.etag;
    }

    return headers;
  }
}
