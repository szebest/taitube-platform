import type {
  PlaylistRepositoryPort,
  SearchHit,
  SearchPage,
  SearchQuery,
  SearchRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import {
  type Channel,
  PUBLIC_FEED_STATUS,
  type Playlist,
  SEARCH_RANKING,
  type SearchResultKind,
  channelSearchScore,
  compareSearchPositions,
  isExactChannelMatch,
  isPublicFeedEligible,
  playlistSearchScore,
  videoSearchScore,
} from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok, unwrapOr } from '@vp/result';
import { type WeightedField, lexicalScore, wordSimilarity } from './search-text';

export interface SearchLookups {
  videosRepo: { getAllVideos(): VideoRecord[] };
  channelsRepo: { getAllChannels(): Channel[] };
  playlistsRepo: Pick<PlaylistRepositoryPort, 'findDetail'> & { getAllPlaylists(): Playlist[] };
}

interface Match {
  score: number;
  matched: boolean;
}

function textMatch(
  query: SearchQuery,
  fields: readonly WeightedField[],
  short: readonly string[]
): Match {
  switch (query.mode) {
    case 'lexical': {
      const score = lexicalScore(query.text, fields);
      return { score, matched: score > 0 };
    }
    case 'fuzzy': {
      const score = Math.max(...short.map((text) => wordSimilarity(query.text, text)));
      return { score, matched: score >= SEARCH_RANKING.fuzzyThreshold };
    }
  }
}

function epochSeconds(date: Date): number {
  return date.getTime() / MS_PER_SECOND;
}

/**
 * Reads the other doubles through their public surface and keeps nothing of its own, so `clear()`
 * has nothing to empty. Scoring follows the same `SEARCH_RANKING` blend as Postgres; only the text
 * match underneath it is approximated.
 */
export class InMemorySearchRepository implements SearchRepositoryPort {
  constructor(private readonly lookups: SearchLookups) {}

  async search(query: SearchQuery): Promise<Result<SearchPage, DatabaseUnavailable>> {
    const matched = (await Promise.all(query.kinds.map((kind) => this.hitsOf(kind, query))))
      .flat()
      .sort(compareSearchPositions);
    const { cursor } = query;
    const after = cursor
      ? matched.filter((hit) => compareSearchPositions(hit, cursor) > 0)
      : matched;
    return ok({ hits: after.slice(0, query.limit + 1), total: matched.length });
  }

  async suggestChannels(
    prefix: string,
    limit: number
  ): Promise<Result<Channel[], DatabaseUnavailable>> {
    const starts = (text: string) => text.toLowerCase().startsWith(prefix);
    return ok(
      this.lookups.channelsRepo
        .getAllChannels()
        .filter((channel) => starts(channel.handle) || starts(channel.displayName))
        .sort((a, b) => b.subscriberCount - a.subscriberCount || b.id.localeCompare(a.id))
        .slice(0, limit)
    );
  }

  clear(): void {}

  private async hitsOf(kind: SearchResultKind, query: SearchQuery): Promise<SearchHit[]> {
    switch (kind) {
      case 'video':
        return this.videoHits(query);
      case 'channel':
        return this.channelHits(query);
      case 'playlist':
        return this.playlistHits(query);
    }
  }

  private videoHits(query: SearchQuery): SearchHit[] {
    return this.lookups.videosRepo.getAllVideos().flatMap((video): SearchHit[] => {
      if (!isPublicFeedEligible(video, query.categoryId)) return [];
      const match = textMatch(
        query,
        [
          { text: video.title ?? '', weight: 'A' },
          { text: (video.tags ?? []).join(' '), weight: 'B' },
          { text: video.description ?? '', weight: 'D' },
        ],
        [video.title ?? '']
      );
      if (!match.matched) return [];
      const keys = {
        relevance: () => videoSearchScore(match.score, video, query.instant),
        date: () => epochSeconds(video.createdAt),
        views: () => video.viewsCount ?? 0,
      };
      return [{ kind: 'video', key: keys[query.sort](), id: video.id, video }];
    });
  }

  private channelHits(query: SearchQuery): SearchHit[] {
    return this.lookups.channelsRepo.getAllChannels().flatMap((channel): SearchHit[] => {
      const exact = isExactChannelMatch(channel, query.text);
      const match = textMatch(
        query,
        [
          { text: channel.handle, weight: 'A' },
          { text: channel.displayName, weight: 'A' },
          { text: channel.bio ?? '', weight: 'C' },
        ],
        [channel.handle, channel.displayName]
      );
      if (!(match.matched || exact)) return [];
      const keys = {
        relevance: () => channelSearchScore(match.score, channel, exact),
        date: () => epochSeconds(channel.createdAt),
        views: () => channel.subscriberCount,
      };
      return [{ kind: 'channel', key: keys[query.sort](), id: channel.id, channel }];
    });
  }

  private async playlistHits(query: SearchQuery): Promise<SearchHit[]> {
    const listed = this.lookups.playlistsRepo
      .getAllPlaylists()
      .filter((playlist) => playlist.visibility === 'public' && !playlist.isSystem);
    const hits = await Promise.all(
      listed.map(async (playlist): Promise<SearchHit[]> => {
        const match = textMatch(
          query,
          [
            { text: playlist.title, weight: 'A' },
            { text: playlist.description, weight: 'B' },
          ],
          [playlist.title]
        );
        if (!match.matched) return [];
        const detail = unwrapOr(
          await this.lookups.playlistsRepo.findDetail(playlist.id, null),
          null
        );
        if (!detail) return [];
        const listed = detail.items.filter((item) => item.video.status === PUBLIC_FEED_STATUS);
        const videoCount = listed.length;
        const keys = {
          relevance: () => playlistSearchScore(match.score, videoCount),
          date: () => epochSeconds(playlist.createdAt),
          views: () => listed.reduce((sum, item) => sum + (item.video.viewsCount ?? 0), 0),
        };
        const coverKey = listed[0]?.video.posterKey ?? null;
        const card = { playlist: detail.playlist, owner: detail.owner, videoCount, coverKey };
        return [{ kind: 'playlist', key: keys[query.sort](), id: playlist.id, card }];
      })
    );
    return hits.flat();
  }
}
