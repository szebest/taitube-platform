import { expectOk } from '@kit/testing/result';
import type { ChannelPostRepositoryPort } from '@vp/core/repositories';
import type { ChannelPost, NewChannelAuditEntry, NewChannelPostInput } from '@vp/domain';
import { OTHER_OWNER_ID, OWNER_CHANNEL_ID, OWNER_ID } from './fixtures';
import type { RepositoriesSubject } from './subjects';

export interface ChannelPostContractContext {
  readonly subject: RepositoriesSubject;
  readonly posts: ChannelPostRepositoryPort;
}

export const POST_IDS = {
  a: '00000000-0000-7000-8000-0000000000a1',
  b: '00000000-0000-7000-8000-0000000000a2',
  c: '00000000-0000-7000-8000-0000000000a3',
  other: '00000000-0000-7000-8000-0000000000a4',
  draft: '00000000-0000-7000-8000-0000000000a5',
  missing: '00000000-0000-7000-8000-0000000000af',
} as const;

export const POST_AT = {
  old: new Date('2026-03-01T10:00:00.000Z'),
  mid: new Date('2026-03-01T11:00:00.000Z'),
  new: new Date('2026-03-01T12:00:00.000Z'),
  pin: new Date('2026-03-01T13:00:00.000Z'),
} as const;

export function postInput(
  id: string,
  channelId = OWNER_CHANNEL_ID,
  commentsEnabled = true
): NewChannelPostInput {
  return {
    id,
    channelId,
    authorUserId: channelId === OWNER_CHANNEL_ID ? OWNER_ID : OTHER_OWNER_ID,
    payload: { kind: 'text', text: `Post ${id.slice(-1)}` },
    commentsEnabled,
  };
}

export function postAudit(
  action: 'post.published' | 'post.updated' | 'post.deleted',
  id: string,
  channelId = OWNER_CHANNEL_ID
): NewChannelAuditEntry {
  return {
    channelId,
    actorUserId: OWNER_ID,
    action,
    targetType: 'post',
    targetId: id,
    meta: { kind: 'text' },
  };
}

export async function publishPost(
  ctx: ChannelPostContractContext,
  id: string,
  channelId = OWNER_CHANNEL_ID
): Promise<ChannelPost> {
  return expectOk(
    await ctx.posts.publish(postInput(id, channelId), postAudit('post.published', id, channelId))
  );
}

export async function auditActions(
  ctx: ChannelPostContractContext,
  channelId = OWNER_CHANNEL_ID
): Promise<string[]> {
  const rows = expectOk(
    await ctx.subject.repositories.channelAudit.list(channelId, { cursor: null, limit: 50 })
  );
  return rows.map((row) => `${row.action}:${row.targetId}`);
}

export async function enqueuedJobs(
  ctx: ChannelPostContractContext
): Promise<{ name: string; data: unknown }[]> {
  const rows = expectOk(await ctx.subject.repositories.outbox.claimBatch(50));
  return rows
    .filter((row) => row.kind === 'notification')
    .flatMap((row) =>
      row.payload.type === 'queue'
        ? [{ name: row.payload.job.name, data: row.payload.job.data }]
        : []
    );
}
