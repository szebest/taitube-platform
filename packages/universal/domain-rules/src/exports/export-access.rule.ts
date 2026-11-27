import { type Result, andThen, assertNever, err, map } from '@kit/result';
import {
  type ActingChannel,
  DATA_EXPORT_KINDS,
  type DataExport,
  type DataExportKind,
} from '@vp/domain';
import {
  type ChannelExportResource,
  type UserContext,
  canDeleteChannelExport,
  canReadChannelExport,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ExportNotFound, exportNotFound } from './failures';

type ExportAccess = 'read' | 'delete';

export interface ExportAccessInput {
  readonly user: UserContext | null;
  readonly acting: ActingChannel;
  readonly access: ExportAccess;
  readonly exportId: string;
  readonly found: DataExport | null;
}

export type ExportAccessFailure = AuthorizationFailure | ExportNotFound;

function allows(
  user: UserContext | null,
  access: ExportAccess,
  channelExport: ChannelExportResource
): boolean {
  switch (access) {
    case 'read':
      return canReadChannelExport({ user, channelExport });
    case 'delete':
      return canDeleteChannelExport({ user, channelExport });
    default:
      return assertNever(access, 'ExportAccess');
  }
}

/**
 * A caller who may export nothing is refused before the lookup, so a 404 never tells them more than
 * a 403 would. An export of another channel is not found: the acting channel is the only one in view.
 */
export function decideExportAccess({
  user,
  acting,
  access,
  exportId,
  found,
}: ExportAccessInput): Result<DataExport, ExportAccessFailure> {
  const { channelId, ownerId } = acting;

  return andThen(
    decideReadableExportKinds({ user, acting }),
    (): Result<DataExport, ExportAccessFailure> => {
      if (!found || found.channelId !== channelId) return err(exportNotFound(exportId));
      const allowed = allows(user, access, { channelId, ownerId, kind: found.kind });
      return map(
        authorize(user, allowed, { action: access, subject: 'ChannelExport' }),
        () => found
      );
    }
  );
}

/** The kinds the caller may see on the acting channel; none at all is a refusal, not an empty list. */
export function decideReadableExportKinds({
  user,
  acting: { channelId, ownerId },
}: Pick<ExportAccessInput, 'user' | 'acting'>): Result<DataExportKind[], AuthorizationFailure> {
  const kinds = DATA_EXPORT_KINDS.filter((kind) =>
    canReadChannelExport({ user, channelExport: { channelId, ownerId, kind } })
  );

  return map(
    authorize(user, kinds.length > 0, { action: 'read', subject: 'ChannelExport' }),
    () => kinds
  );
}
