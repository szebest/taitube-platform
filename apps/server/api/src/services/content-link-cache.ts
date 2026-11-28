import { ignore, isOk, parseJson, unwrapOr } from '@kit/result';
import type { CacheClient } from '@vp/core/ports';
import type { TouchingLink } from '@vp/core/repositories';
import {
  type ContentLink,
  CONTENT_LINK_CACHE_SECONDS,
  type ContentRef,
  contentRefKey,
} from '@vp/domain';
import { CacheKeys } from '@vp/events';

interface CachedTouching {
  direction: TouchingLink['direction'];
  link: Omit<ContentLink, 'createdAt'> & { createdAt: string };
}

/**
 * The stored links of a ref for 60 seconds. It holds links and never titles or visibility, which
 * every read decides afresh, so a target that turned private never shows through it. Every failure
 * of the cache costs a database read and never correctness.
 */
export class ContentLinkCache {
  constructor(private readonly cache: CacheClient) {}

  async read(ref: ContentRef): Promise<TouchingLink[] | undefined> {
    const raw = unwrapOr(await this.cache.get(CacheKeys.contentLinks(contentRefKey(ref))), null);
    if (!raw) return undefined;
    const parsed = parseJson(raw);
    if (!isOk(parsed) || !Array.isArray(parsed.value)) return undefined;
    return (parsed.value as CachedTouching[]).map(({ direction, link }) => ({
      direction,
      ref,
      link: { ...link, createdAt: new Date(link.createdAt) },
    }));
  }

  async write(ref: ContentRef, found: readonly TouchingLink[]): Promise<void> {
    const entries: CachedTouching[] = found.map(({ direction, link }) => ({
      direction,
      link: { ...link, createdAt: link.createdAt.toISOString() },
    }));
    ignore(
      await this.cache.set(
        CacheKeys.contentLinks(contentRefKey(ref)),
        JSON.stringify(entries),
        CONTENT_LINK_CACHE_SECONDS
      ),
      'a cold cache costs a database read, never correctness'
    );
  }

  async drop(refs: readonly ContentRef[]): Promise<void> {
    for (const ref of refs) {
      ignore(
        await this.cache.del(CacheKeys.contentLinks(contentRefKey(ref))),
        'the write committed; the entry expires within a minute'
      );
    }
  }
}
