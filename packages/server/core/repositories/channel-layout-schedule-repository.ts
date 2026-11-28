import type { Result } from '@kit/result';
import type { LayoutScheduleStatus, NewChannelAuditEntry, StoredLayout } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ChannelLayoutSchedule {
  id: string;
  channelId: string;
  document: StoredLayout;
  publishAt: Date;
  status: LayoutScheduleStatus;
  createdBy: string | null;
  createdAt: Date;
}

export type NewChannelLayoutSchedule = Pick<
  ChannelLayoutSchedule,
  'id' | 'channelId' | 'document' | 'publishAt' | 'createdBy'
>;

export interface ChannelLayoutScheduleRepositoryPort {
  create(
    input: NewChannelLayoutSchedule,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule, DatabaseUnavailable>>;
  listPending(channelId: string): Promise<Result<ChannelLayoutSchedule[], DatabaseUnavailable>>;
  cancel(
    channelId: string,
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule | null, DatabaseUnavailable>>;
  promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>>;
}
