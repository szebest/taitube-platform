import {
  type ActingChannel,
  DATA_EXPORT_LIMITS,
  type DataExportKind,
  type DataExportUsage,
} from '@vp/domain';
import { type UserContext, canCreateChannelExport } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ExportDailyLimit,
  type ExportInProgress,
  exportDailyLimit,
  exportInProgress,
} from './failures';

export interface RequestExportInput {
  readonly user: UserContext | null;
  readonly acting: ActingChannel;
  readonly kind: DataExportKind;
  readonly usage: DataExportUsage;
}

export type RequestExportFailure = AuthorizationFailure | ExportInProgress | ExportDailyLimit;

/** One export at a time per channel and a daily cap, checked only for a caller allowed the kind. */
export function decideExportRequest({
  user,
  acting,
  kind,
  usage,
}: RequestExportInput): Result<UserContext, RequestExportFailure> {
  const { channelId, ownerId } = acting;
  const allowed = canCreateChannelExport({ user, channelExport: { channelId, ownerId, kind } });

  return andThen(
    authorize(user, allowed, { action: 'create', subject: 'ChannelExport' }),
    (requester): Result<UserContext, RequestExportFailure> => {
      if (usage.running) return err(exportInProgress());
      if (usage.today >= DATA_EXPORT_LIMITS.perDay) return err(exportDailyLimit());
      return ok(requester);
    }
  );
}
