import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import { exportColumns } from '@vp/api-contracts';
import type { QueueJob, StorageClient, WebhookDispatcher } from '@vp/core/ports';
import type { ExportScope, Repositories } from '@vp/core/repositories';
import {
  DATA_EXPORT_LIMITS,
  DATA_EXPORT_PAGE_SIZE,
  type DataExport,
  type DataExportFormat,
  type DataExportKind,
  type ExportRowPage,
  dataExportExpiry,
} from '@vp/domain';
import { type ExportTooLarge, exportTooLarge } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  RETRY_CLASS,
  type StorageUnavailable,
} from '@vp/errors';
import type { ExportJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, assertNever, err, isErr, ok } from '@vp/result';
import { exportObjectKey } from '@vp/storage';
import { createScratchDir, removeScratchDir } from '../scratch-dir';
import { createWebhookFanout } from '../webhook-fanout';
import { csvEncoder } from './csv-encoder';
import type { ExportEncoder } from './export-encoder';
import { openExportFile } from './export-file';
import { jsonEncoder } from './json-encoder';

export interface ExportProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  webhookDispatcher: WebhookDispatcher;
  bucket: string;
  tmpDir: string;
  logger: Logger;
  now: () => number;
  limits?: { maxRows: number; maxBytes: number; pageSize: number };
}

export type ExportStageFailure = ExportTooLarge | DatabaseUnavailable | StorageUnavailable;

export interface ExportResult {
  exportId: string;
  rowCount: number | null;
}

type Pull = (
  after: string | null
) => Promise<Result<ExportRowPage<Readonly<Record<string, unknown>>>, DatabaseUnavailable>>;

const CONTENT_TYPES: Record<DataExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

function encoderFor(format: DataExportFormat, kind: DataExportKind): ExportEncoder {
  switch (format) {
    case 'csv':
      return csvEncoder(exportColumns(kind));
    case 'json':
      return jsonEncoder();
    default:
      return assertNever(format, 'DataExportFormat');
  }
}

/** What the requester is told; anything but the size cap is the platform's to retry, not theirs. */
function reasonOf(failure: ExportStageFailure): string {
  return failure.code === ErrorCodes.EXPORT_TOO_LARGE
    ? failure.message
    : 'The export could not be written';
}

/**
 * Writes every row of an export to a scratch file a keyset page at a time, uploads it to the
 * export's private key and marks it ready, so memory holds one page whatever the export's size. A
 * settled or deleted export is left alone, which makes a retried or duplicated job a no-op.
 */
export function createExportProcessor(deps: ExportProcessorDeps) {
  const { repositories, storage, bucket, logger, now } = deps;
  const { maxRows, maxBytes } = deps.limits ?? DATA_EXPORT_LIMITS;
  const pageSize = deps.limits?.pageSize ?? DATA_EXPORT_PAGE_SIZE;
  const exports = repositories.dataExports;
  const announce = createWebhookFanout({
    webhooks: repositories.webhooks,
    dispatcher: deps.webhookDispatcher,
    logger,
  });

  function pullerOf(kind: DataExportKind, scope: ExportScope): Pull {
    const rows = repositories.exportRows;
    switch (kind) {
      case 'video_analytics':
        return (after) => rows.videoAnalytics(scope, after, pageSize);
      case 'channel_analytics':
        return (after) => rows.channelAnalytics(scope, after, pageSize);
      case 'comments':
        return (after) => rows.comments(scope, after, pageSize);
      case 'videos':
        return (after) => rows.videos(scope, after, pageSize);
      default:
        return assertNever(kind, 'DataExportKind');
    }
  }

  async function write(
    target: string,
    { kind, format }: DataExport,
    pull: Pull
  ): Promise<Result<number, ExportStageFailure>> {
    const encoder = encoderFor(format, kind);
    const file = openExportFile(target);
    let rowCount = 0;
    let after: string | null = null;
    try {
      await file.write(encoder.start);
      do {
        const page = await pull(after);
        if (isErr(page)) return page;
        for (const row of page.value.rows) {
          await file.write(encoder.row(row));
          rowCount += 1;
          if (rowCount > maxRows || file.bytes > maxBytes) return err(exportTooLarge());
        }
        after = page.value.next;
      } while (after !== null);
      await file.write(encoder.end);
      return ok(rowCount);
    } finally {
      await file.close();
    }
  }

  async function run(
    started: DataExport,
    ownerId: string,
    tmpDir: string
  ): Promise<Result<ExportResult, ExportStageFailure>> {
    const { id, channelId, kind, format, params } = started;
    const target = path.join(tmpDir, `${id}.${format}`);
    const written = await write(
      target,
      started,
      pullerOf(kind, { channelId, ownerId, range: params })
    );
    if (isErr(written)) return written;

    const objectKey = exportObjectKey(channelId, id, format);
    const uploaded = await storage.uploadObject({
      bucket,
      key: objectKey,
      body: createReadStream(target),
      contentType: CONTENT_TYPES[format],
    });
    if (isErr(uploaded)) return uploaded;

    const expiresAt = dataExportExpiry(new Date(now()));
    const finished = await exports.finish(id, { objectKey, rowCount: written.value, expiresAt });
    if (isErr(finished)) return finished;
    if (!finished.value) {
      const discarded = await storage.deleteObject(bucket, objectKey);
      if (isErr(discarded)) return discarded;
      return ok({ exportId: id, rowCount: null });
    }

    await announce(ownerId, 'export.ready', {
      exportId: id,
      channelId,
      kind,
      format,
      rowCount: written.value,
      expiresAt: expiresAt.toISOString(),
    });
    return ok({ exportId: id, rowCount: written.value });
  }

  return async function processExportJob(
    job: QueueJob<ExportJob>
  ): Promise<Result<ExportResult, ExportStageFailure>> {
    const { exportId } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ exportId, jobId: job.id, stage: 'export', attempt });
    const lastAttempt = job.opts?.attempts !== undefined && attempt >= job.opts.attempts;
    const skipped = ok({ exportId, rowCount: null });

    const started = await exports.start(exportId);
    if (isErr(started)) return started;
    if (!started.value) {
      log.info('export settled or deleted; nothing to do');
      return skipped;
    }
    const channel = await repositories.channels.findById(started.value.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return skipped;

    const tmpDir = await createScratchDir(deps.tmpDir, `vp-export-${exportId}-`);
    try {
      const outcome = await run(started.value, channel.value.userId, tmpDir);
      if (!isErr(outcome)) {
        log.info({ rowCount: outcome.value.rowCount }, 'export written');
        return outcome;
      }

      log.error({ err: outcome.error }, 'export job failed');
      if (RETRY_CLASS[outcome.error.code] === 'permanent' || lastAttempt) {
        const recorded = await exports.fail(exportId, reasonOf(outcome.error));
        if (isErr(recorded)) return recorded;
      }
      return outcome;
    } finally {
      await removeScratchDir(tmpDir);
    }
  };
}
