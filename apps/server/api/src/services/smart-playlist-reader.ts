import { createHash } from 'node:crypto';
import { type Result, ignore, isOk, map, ok, parseJson, unwrapOr } from '@kit/result';
import { PlaylistItemSchema, type PlaylistView } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { SmartPlaylistEntry, SmartPlaylistRepositoryPort } from '@vp/core/repositories';
import { SMART_PLAYLIST_CACHE_SECONDS, type SmartPlaylistRules, dependsOnViewer } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { z } from 'zod';
import { toPlaylistItemView } from './library-views';
import type { SpriteGeometry } from './video-views';

export interface SmartPlaylistReaderDeps {
  smart: SmartPlaylistRepositoryPort;
  cache: Pick<CacheClient, 'get' | 'set'>;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  now: () => number;
}

export interface SmartPlaylistSource {
  id: string;
  rules: SmartPlaylistRules;
}

const SmartRowsSchema = z.array(z.object({ item: PlaylistItemSchema, key: z.number() }));

/** A computed item as the API shows it, with the sort key its page's cursor carries. */
export type SmartRow = z.infer<typeof SmartRowsSchema>[number];

function toItemView(
  { video, channel, position }: SmartPlaylistEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): PlaylistView['items'][number] {
  return toPlaylistItemView(
    {
      id: video.id,
      videoId: video.id,
      position,
      addedAt: video.createdAt,
      addedBy: null,
      note: null,
      startMs: null,
      endMs: null,
      video,
      channel,
    },
    cdn,
    sprite
  );
}

/**
 * Pages a smart playlist's computed items. A page that does not read the viewer, which is any page
 * of rules without `unwatched` and any guest's page, is cached for a minute under its rules, so an
 * edit to the rules misses the cache at once.
 */
export class SmartPlaylistReader {
  constructor(private readonly deps: SmartPlaylistReaderDeps) {}

  async page(
    playlist: SmartPlaylistSource,
    viewer: UserContext | null,
    { cursor, limit }: { cursor: { key: number; id: string } | null; limit: number }
  ): Promise<Result<SmartRow[], DatabaseUnavailable>> {
    const cacheKey = dependsOnViewer(playlist.rules, viewer?.id ?? null)
      ? null
      : CacheKeys.smartPlaylistPage(
          playlist.id,
          fingerprintOf({ rules: playlist.rules, cursor, limit })
        );
    const cached = cacheKey === null ? null : await this.read(cacheKey);
    if (cached) return ok(cached);

    const { cdn, sprite } = this.deps;
    const evaluated = await this.deps.smart.evaluate(playlist.rules, viewer, {
      cursor,
      limit,
      now: new Date(this.deps.now()),
    });
    const rows = map(evaluated, (entries) =>
      entries.map((entry) => ({ item: toItemView(entry, cdn, sprite), key: entry.key }))
    );
    if (isOk(rows) && cacheKey !== null) await this.write(cacheKey, rows.value);
    return rows;
  }

  private async read(cacheKey: string): Promise<SmartRow[] | null> {
    const raw = unwrapOr(await this.deps.cache.get(cacheKey), null);
    if (raw === null) return null;
    const parsed = parseJson(raw);
    if (!isOk(parsed)) return null;
    const rows = SmartRowsSchema.safeParse(parsed.value);
    return rows.success ? rows.data : null;
  }

  private async write(cacheKey: string, rows: readonly SmartRow[]): Promise<void> {
    ignore(
      await this.deps.cache.set(cacheKey, JSON.stringify(rows), SMART_PLAYLIST_CACHE_SECONDS),
      'a cold cache costs one query, never a wrong answer'
    );
  }
}

function fingerprintOf(request: object): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('base64url');
}
