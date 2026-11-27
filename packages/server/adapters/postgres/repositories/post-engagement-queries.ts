import * as schema from '@vp/db';
import { type PostPayload, type PostStats } from '@vp/domain';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { channelPosts: p, postPollVotes: v, postStatsDaily: d } = schema;

const OPTION_SLOTS = 6;

export async function talliesOf(
  db: PostgresDatabase,
  postIds: readonly string[]
): Promise<Map<string, number[]>> {
  const found = new Map<string, number[]>();
  if (postIds.length === 0) return found;
  const rows = await db
    .select({ postId: v.postId, optionIndex: v.optionIndex, total: count() })
    .from(v)
    .where(inArray(v.postId, [...postIds]))
    .groupBy(v.postId, v.optionIndex);
  for (const { postId, optionIndex, total } of rows) {
    const counts = found.get(postId) ?? new Array<number>(OPTION_SLOTS).fill(0);
    counts[optionIndex] = total;
    found.set(postId, counts);
  }
  return found;
}

function correctShare(payload: PostPayload, votes: number[]): number | null {
  if (payload.kind !== 'quiz') return null;
  const total = votes.reduce((sum, option) => sum + option, 0);
  return total === 0 ? null : (votes[payload.correctIndex] ?? 0) / total;
}

export async function statsOf(db: PostgresDatabase, postId: string): Promise<PostStats | null> {
  const [post] = await db
    .select({ payload: p.payload, likes: p.likeCount, replies: p.commentsCount })
    .from(p)
    .where(eq(p.id, postId));
  if (!post) return null;
  const [days] = await db
    .select({
      opens: sql<number>`coalesce(sum(${d.opens}), 0)::int`,
      shareClicks: sql<number>`coalesce(sum(${d.shareClicks}), 0)::int`,
    })
    .from(d)
    .where(eq(d.postId, postId));
  const votes =
    (await talliesOf(db, [postId])).get(postId) ?? new Array<number>(OPTION_SLOTS).fill(0);
  const options =
    post.payload.kind === 'poll' || post.payload.kind === 'quiz' ? post.payload.options.length : 0;
  return {
    opens: days?.opens ?? 0,
    shareClicks: days?.shareClicks ?? 0,
    likes: post.likes,
    replies: post.replies,
    votesByOption: votes.slice(0, options),
    quizCorrectShare: correctShare(post.payload, votes),
  };
}

export async function votedIndexesOf(
  db: PostgresDatabase,
  postIds: readonly string[],
  userId: string
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({ postId: v.postId, optionIndex: v.optionIndex })
    .from(v)
    .where(and(eq(v.userId, userId), inArray(v.postId, [...postIds])));
  return new Map(rows.map((row) => [row.postId, row.optionIndex]));
}
