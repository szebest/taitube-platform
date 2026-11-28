import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { ChannelCard, SmartPlaylistRules, Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

/** A video a smart playlist computed, its 0-based place in it, and the value its sort compares. */
export interface SmartPlaylistEntry {
  video: Video;
  channel: ChannelCard | null;
  position: number;
  key: number;
}

export interface EvaluateRulesOptions {
  /** The sort key and id of the last entry of the page before. */
  cursor: { key: number; id: string } | null;
  limit: number;
  /** The instant `newer_than` counts back from. */
  now: Date;
}

/**
 * Computes a smart playlist over the public feed, in one query: the rules become its predicate, the
 * first `rules.limit` videos in the rules' sort are the playlist, and a page is keyset on that sort
 * within them. `unwatched` reads the viewer's history; a guest has watched nothing.
 */
export interface SmartPlaylistRepositoryPort {
  evaluate(
    rules: SmartPlaylistRules,
    viewer: UserContext | null,
    options: EvaluateRulesOptions
  ): Promise<Result<SmartPlaylistEntry[], DatabaseUnavailable>>;
}
