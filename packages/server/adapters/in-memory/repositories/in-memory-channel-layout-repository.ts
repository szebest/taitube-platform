import { type Result, isErr, ok } from '@kit/result';
import type {
  ChannelLayoutDraft,
  ChannelLayoutDraftSaved,
  ChannelLayoutRepositoryPort,
  PublishChannelLayout,
  PublishedChannelLayout,
  SaveChannelLayoutDraft,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Clock, realClock } from './clock';
import {
  type ChannelLayoutPublishDeps,
  publishChannelLayout,
} from './in-memory-channel-layout-publish';

export class InMemoryChannelLayoutRepository implements ChannelLayoutRepositoryPort {
  private readonly drafts = new Map<string, ChannelLayoutDraft>();

  constructor(
    private readonly deps: ChannelLayoutPublishDeps,
    private readonly now: Clock = realClock
  ) {}

  async getDraft(
    channelId: string
  ): Promise<Result<ChannelLayoutDraft | null, DatabaseUnavailable>> {
    const draft = this.drafts.get(channelId);
    return ok(draft ? { ...draft } : null);
  }

  async saveDraft(
    input: SaveChannelLayoutDraft
  ): Promise<Result<ChannelLayoutDraftSaved, DatabaseUnavailable>> {
    const { channelId, document, expectedVersion, userId, audit } = input;
    const current = this.drafts.get(channelId);
    if ((current?.version ?? 0) !== expectedVersion) return ok({ type: 'stale' });
    const written = await this.deps.audit.append(audit);
    if (isErr(written)) return written;
    const draft: ChannelLayoutDraft = {
      channelId,
      document,
      version: expectedVersion + 1,
      updatedBy: userId,
      updatedAt: new Date(this.now()),
    };
    this.drafts.set(channelId, draft);
    return ok({ type: 'saved', draft: { ...draft } });
  }

  async getPublished(
    channelId: string
  ): Promise<Result<PublishedChannelLayout | null, DatabaseUnavailable>> {
    const newest = await this.deps.revisions.list('channel_layout', channelId, {
      beforeVersion: null,
      limit: 1,
    });
    if (isErr(newest)) return newest;
    const [row] = newest.value;
    return ok(
      row
        ? {
            version: row.version,
            document: row.snapshot.document,
            note: row.snapshot.note,
            authorUserId: row.authorUserId,
            restoredFromVersion: row.restoredFromVersion,
            createdAt: row.createdAt,
          }
        : null
    );
  }

  async publish(
    input: PublishChannelLayout
  ): Promise<Result<PublishedChannelLayout, DatabaseUnavailable>> {
    return publishChannelLayout(this.deps, input, new Date(this.now()));
  }

  clear(): void {
    this.drafts.clear();
  }
}
