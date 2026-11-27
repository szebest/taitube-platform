import type { InvalidCursor, Paginator } from '@kit/pagination';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, err, isErr, map, ok } from '@kit/result';
import type {
  CreateExportBody,
  DataExportDetailView,
  DataExportPageView,
  DataExportView,
} from '@vp/api-contracts';
import type { StorageClient } from '@vp/core/ports';
import type { DataExportRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel, DataExport, NewChannelAuditEntry } from '@vp/domain';
import {
  type AuthorizationFailure,
  type ExportAccessFailure,
  type RequestExportFailure,
  decideExportAccess,
  decideExportRequest,
  decideReadableExportKinds,
  exportInProgress,
} from '@vp/domain-rules';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { auditActor } from './audit-actor';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface ChannelExportServiceDeps {
  exports: DataExportRepositoryPort;
  storage: Pick<StorageClient, 'createPresignedGetUrl' | 'deleteObject'>;
  bucket: string;
  downloadTtlSeconds: number;
  paginator: Paginator;
  now: () => number;
}

export interface ChannelExportQuery {
  cursor?: string;
  limit?: number;
}

function auditOf(
  action: 'export.requested' | 'export.deleted',
  { id, channelId, kind, format }: Pick<DataExport, 'id' | 'channelId' | 'kind' | 'format'>,
  actor: UserContext
): NewChannelAuditEntry {
  return {
    channelId,
    ...auditActor(actor),
    action,
    targetType: 'export',
    targetId: id,
    meta: { kind, format },
  };
}

function toView({
  channelId: _channel,
  objectKey: _key,
  expiresAt,
  createdAt,
  ...rest
}: DataExport): DataExportView {
  return {
    ...rest,
    expiresAt: expiresAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
  };
}

/** Exports of the acting channel's data; the job writes the file, this asks for it and hands it out. */
export class ChannelExportService {
  constructor(private readonly deps: ChannelExportServiceDeps) {}

  async create(
    user: UserContext,
    acting: ActingChannel,
    { kind, format, params }: CreateExportBody
  ): Promise<Result<DataExportView, RequestExportFailure | DatabaseUnavailable>> {
    const { exports, now } = this.deps;
    const usage = await exports.usage(acting.channelId, new Date(now() - MS_PER_DAY));
    if (isErr(usage)) return usage;
    const decided = decideExportRequest({ user, acting, kind, usage: usage.value });
    if (isErr(decided)) return decided;

    const request = {
      id: uuidv7(),
      channelId: acting.channelId,
      requestedBy: user.id,
      kind,
      params,
      format,
    };
    const created = await exports.create(request, auditOf('export.requested', request, user));
    if (isErr(created)) return created;
    const outcome = created.value;
    return outcome.type === 'created' ? ok(toView(outcome.dataExport)) : err(exportInProgress());
  }

  async list(
    user: UserContext,
    acting: ActingChannel,
    query: ChannelExportQuery
  ): Promise<
    Result<DataExportPageView, AuthorizationFailure | InvalidCursor | DatabaseUnavailable>
  > {
    const { exports, paginator } = this.deps;
    const kinds = decideReadableExportKinds({ user, acting });
    if (isErr(kinds)) return kinds;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const rows = await exports.list(acting.channelId, {
      kinds: kinds.value,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, { cursorOf: createdAtCursorPayload, toItem: toView })
    );
  }

  async get(
    user: UserContext,
    acting: ActingChannel,
    exportId: string
  ): Promise<
    Result<DataExportDetailView, ExportAccessFailure | DatabaseUnavailable | StorageUnavailable>
  > {
    const { exports, storage, bucket, downloadTtlSeconds } = this.deps;
    const found = await exports.findById(exportId);
    if (isErr(found)) return found;
    const allowed = decideExportAccess({
      user,
      acting,
      access: 'read',
      exportId,
      found: found.value,
    });
    if (isErr(allowed)) return allowed;
    const dataExport = allowed.value;

    const { objectKey } = dataExport;
    if (objectKey === null) return ok({ ...toView(dataExport), downloadUrl: null });
    const url = await storage.createPresignedGetUrl({
      bucket,
      key: objectKey,
      expiresInSeconds: downloadTtlSeconds,
    });
    return map(url, (downloadUrl) => ({ ...toView(dataExport), downloadUrl }));
  }

  /** The file goes first, so a failure leaves the export listed for the caller to delete again. */
  async remove(
    user: UserContext,
    acting: ActingChannel,
    exportId: string
  ): Promise<Result<void, ExportAccessFailure | DatabaseUnavailable | StorageUnavailable>> {
    const { exports, storage, bucket } = this.deps;
    const found = await exports.findById(exportId);
    if (isErr(found)) return found;
    const allowed = decideExportAccess({
      user,
      acting,
      access: 'delete',
      exportId,
      found: found.value,
    });
    if (isErr(allowed)) return allowed;

    const { objectKey } = allowed.value;
    if (objectKey !== null) {
      const deleted = await storage.deleteObject(bucket, objectKey);
      if (isErr(deleted)) return deleted;
    }
    const removed = await exports.remove(exportId, auditOf('export.deleted', allowed.value, user));
    return map(removed, () => undefined);
  }
}
