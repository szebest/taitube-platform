import { type Result, isErr, ok } from '@kit/result';
import type {
  EntityRevisionRepository,
  PublishChannelLayout,
  PublishedChannelLayout,
} from '@vp/core/repositories';
import type { ChannelAuditEntry, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ChannelLayoutPublishDeps {
  revisions: Pick<EntityRevisionRepository, 'append' | 'list'>;
  audit: {
    append(entry: NewChannelAuditEntry): Promise<Result<ChannelAuditEntry, DatabaseUnavailable>>;
  };
}

/** The next revision of the channel and its audit entry; the in-memory form of the one transaction. */
export async function publishChannelLayout(
  { revisions, audit }: ChannelLayoutPublishDeps,
  input: PublishChannelLayout,
  now: Date
): Promise<Result<PublishedChannelLayout, DatabaseUnavailable>> {
  const { channelId, document, authorUserId, note, restoredFromVersion } = input;
  const newest = await revisions.list('channel_layout', channelId, {
    beforeVersion: null,
    limit: 1,
  });
  if (isErr(newest)) return newest;
  const version = (newest.value[0]?.version ?? 0) + 1;
  const appended = await revisions.append({
    entityType: 'channel_layout',
    entityId: channelId,
    version,
    snapshot: { document, note },
    authorUserId,
    restoredFromVersion,
  });
  if (isErr(appended)) return appended;
  if (input.audit) {
    const written = await audit.append(input.audit(version));
    if (isErr(written)) return written;
  }
  return ok({ version, document, note, authorUserId, restoredFromVersion, createdAt: now });
}
