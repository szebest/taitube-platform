import {
  COMMENT_TEXTS,
  PLAYLIST_TITLES,
  REPLY_TEXTS,
  REPORT_NOTES,
  SEARCH_QUERIES,
} from './catalog';
import type { Rng } from './rng';
import type {
  CommentSpec,
  FeaturedSpec,
  HistorySpec,
  PlaylistSpec,
  ReactionSpec,
  ReportSpec,
  SearchSpec,
  SubscriptionSpec,
  UserSpec,
  VideoSpec,
  WorldSpec,
} from './world-types';

type Engagement = Pick<
  WorldSpec,
  | 'comments'
  | 'reactions'
  | 'subscriptions'
  | 'playlists'
  | 'history'
  | 'searches'
  | 'reports'
  | 'featured'
>;

const REPORT_REASONS = ['spam', 'harassment', 'misinformation', 'other'] as const;

function buildComments(rng: Rng, users: readonly UserSpec[], videos: readonly VideoSpec[]) {
  return videos
    .filter((video) => video.visibility !== 'private')
    .flatMap((video): CommentSpec[] => {
      const others = users.filter((user) => user.id !== video.ownerId);
      const authors = rng.sample(others, rng.int(1, Math.min(4, others.length)));
      const texts = rng.sample(COMMENT_TEXTS, authors.length);
      return authors.map((author, position) => {
        const repliers = rng.sample(
          users.filter((user) => user.id !== author.id),
          rng.int(0, 2)
        );
        return {
          videoKey: video.key,
          authorId: author.id,
          text: texts[position] ?? COMMENT_TEXTS[0],
          pinned: position === 0,
          hearted: position <= 1,
          replies: repliers.map((replier, replyIndex) => ({
            authorId: replier.id,
            text: REPLY_TEXTS[(position + replyIndex) % REPLY_TEXTS.length] ?? REPLY_TEXTS[0],
          })),
        };
      });
    });
}

function buildReactions(rng: Rng, users: readonly UserSpec[], videos: readonly VideoSpec[]) {
  return videos
    .filter((video) => video.visibility === 'public')
    .flatMap((video): ReactionSpec[] =>
      rng
        .sample(
          users.filter((user) => user.id !== video.ownerId),
          rng.int(2, users.length)
        )
        .map((user) => ({
          videoKey: video.key,
          userId: user.id,
          type: rng.chance(0.1) ? 'DISLIKE' : 'LIKE',
        }))
    );
}

function buildSubscriptions(rng: Rng, users: readonly UserSpec[]): SubscriptionSpec[] {
  const owners = users.filter((user) => user.ownsChannel);
  return users.flatMap((subscriber) =>
    rng
      .sample(
        owners.filter((owner) => owner.id !== subscriber.id),
        rng.int(1, 3)
      )
      .map((owner) => ({ subscriberId: subscriber.id, channelOwnerId: owner.id }))
  );
}

function buildPlaylists(rng: Rng, users: readonly UserSpec[], videos: readonly VideoSpec[]) {
  const listed = videos.filter((video) => video.visibility === 'public');
  if (listed.length === 0) return [];
  const viewer = users.find((user) => user.kind === 'viewer');
  const creator = users.find((user) => user.kind === 'creator');
  const owners = [
    viewer,
    creator,
    ...rng.sample(
      users.filter((user) => user.kind === 'fan'),
      2
    ),
  ];
  return owners.flatMap((owner, index): PlaylistSpec[] =>
    owner
      ? [
          {
            ownerId: owner.id,
            title: PLAYLIST_TITLES[index % PLAYLIST_TITLES.length] ?? PLAYLIST_TITLES[0],
            description: `A hand-picked list by ${owner.displayName}.`,
            visibility: index === 1 ? 'public' : 'private',
            videoKeys: rng.sample(listed, Math.min(listed.length, rng.int(2, 4))).map((v) => v.key),
          },
        ]
      : []
  );
}

function buildHistory(rng: Rng, users: readonly UserSpec[], videos: readonly VideoSpec[]) {
  const listed = videos.filter((video) => video.visibility === 'public');
  return users
    .filter((user) => user.kind === 'viewer' || user.kind === 'fan')
    .slice(0, 3)
    .flatMap((user): HistorySpec[] =>
      rng.sample(listed, Math.min(listed.length, 3)).map((video) => ({
        userId: user.id,
        videoKey: video.key,
        fraction: Math.round((0.2 + rng.next() * 0.8) * 100) / 100,
      }))
    );
}

function buildSearches(rng: Rng, users: readonly UserSpec[]): SearchSpec[] {
  const viewer = users.find((user) => user.kind === 'viewer');
  return viewer ? rng.sample(SEARCH_QUERIES, 3).map((query) => ({ userId: viewer.id, query })) : [];
}

function buildReports(rng: Rng, comments: readonly CommentSpec[], users: readonly UserSpec[]) {
  const reporters = users.filter((user) => user.kind === 'viewer' || user.kind === 'fan');
  return rng.sample(comments, Math.min(2, comments.length)).flatMap((comment): ReportSpec[] => {
    const reporter = reporters.find((user) => user.id !== comment.authorId);
    return reporter
      ? [
          {
            reporterId: reporter.id,
            videoKey: comment.videoKey,
            commentText: comment.text,
            commentAuthorId: comment.authorId,
            reason: rng.pick(REPORT_REASONS),
            note: rng.pick(REPORT_NOTES),
          },
        ]
      : [];
  });
}

function buildFeatured(users: readonly UserSpec[], videos: readonly VideoSpec[]): FeaturedSpec[] {
  return users
    .filter((user) => user.ownsChannel)
    .flatMap((owner): FeaturedSpec[] => {
      const own = videos.filter((v) => v.ownerId === owner.id && v.visibility === 'public');
      return own.length === 0
        ? []
        : [
            {
              ownerId: owner.id,
              videoKeys: own.slice(0, 3).map((video) => video.key),
              trailerVideoKey: own[0]?.key ?? null,
            },
          ];
    });
}

export function buildEngagement(
  rng: Rng,
  users: readonly UserSpec[],
  videos: readonly VideoSpec[]
): Engagement {
  const comments = buildComments(rng, users, videos);
  return {
    comments,
    reactions: buildReactions(rng, users, videos),
    subscriptions: buildSubscriptions(rng, users),
    playlists: buildPlaylists(rng, users, videos),
    history: buildHistory(rng, users, videos),
    searches: buildSearches(rng, users),
    reports: buildReports(rng, comments, users),
    featured: buildFeatured(users, videos),
  };
}
