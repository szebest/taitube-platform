import type { Result } from '@kit/result';
import type { NewChannelAuditEntry, StoredLayout } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type ChannelLayoutScheduleStatus = 'pending' | 'applied' | 'cancelled';

export interface ChannelLayoutSchedule {
  id: string;
  channelId: string;
  document: StoredLayout;
  publishAt: Date;
  status: ChannelLayoutScheduleStatus;
  createdBy: string | null;
  createdAt: Date;
}

export type NewChannelLayoutSchedule = Pick<
  ChannelLayoutSchedule,
  'id' | 'channelId' | 'document' | 'publishAt' | 'createdBy'
>;

/** A layout queued to go live; a schedule applies once, through a compare-and-set on its status. */
export interface ChannelLayoutScheduleRepositoryPort {
  create(
    input: NewChannelLayoutSchedule,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule, DatabaseUnavailable>>;
  listPending(channelId: string): Promise<Result<ChannelLayoutSchedule[], DatabaseUnavailable>>;
  /** Null when the schedule is not this channel's or is no longer pending. */
  cancel(
    channelId: string,
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule | null, DatabaseUnavailable>>;
  /**
   * Applies every pending schedule whose time has come, oldest first, each as a revision with its
   * audit entry in one transaction. Answers the ids this call applied, so a second run answers none.
   */
  promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>>;
}
