import type { Result } from '@kit/result';
import type { NewChannelAuditEntry, StoredLayout } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ChannelLayoutDraft {
  channelId: string;
  document: StoredLayout;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface PublishedChannelLayout {
  version: number;
  document: StoredLayout;
  note: string | null;
  authorUserId: string | null;
  restoredFromVersion: number | null;
  createdAt: Date;
}

export interface SaveChannelLayoutDraft {
  channelId: string;
  document: StoredLayout;
  /** The version the caller read; 0 when the channel had no draft. */
  expectedVersion: number;
  userId: string;
  audit: NewChannelAuditEntry;
}

export type ChannelLayoutDraftSaved =
  | { type: 'saved'; draft: ChannelLayoutDraft }
  | { type: 'stale' };

export interface PublishChannelLayout {
  channelId: string;
  document: StoredLayout;
  authorUserId: string | null;
  note: string | null;
  restoredFromVersion: number | null;
  /** Built once the new revision's version is known. */
  audit: ((version: number) => NewChannelAuditEntry) | null;
}

/**
 * The one draft of a channel page and its published layouts. A published layout is the newest
 * `entity_revisions` row of type `channel_layout`; publishing appends one with its audit entry in
 * one transaction, so history is never rewritten.
 */
export interface ChannelLayoutRepositoryPort {
  getDraft(channelId: string): Promise<Result<ChannelLayoutDraft | null, DatabaseUnavailable>>;
  saveDraft(
    input: SaveChannelLayoutDraft
  ): Promise<Result<ChannelLayoutDraftSaved, DatabaseUnavailable>>;
  getPublished(
    channelId: string
  ): Promise<Result<PublishedChannelLayout | null, DatabaseUnavailable>>;
  publish(
    input: PublishChannelLayout
  ): Promise<Result<PublishedChannelLayout, DatabaseUnavailable>>;
}
