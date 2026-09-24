#!/usr/bin/env node
import * as fs from 'node:fs';
import { type Logger, createLogger } from '@vp/logger';
import { UploadClient } from './client';

function parseArgs(args: string[]) {
  let file = '';
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else if (!file) {
      file = arg;
    }
  }

  return { file, flags };
}

function printHelp(): void {
  process.stdout.write(`
@vp/upload-client — Reference resumable multipart upload client (Ticket 11)

Usage:
  pnpm upload-client <file> [options]
  pnpm upload-client --resume <uploadId> <file> [options]
  pnpm upload-client --abort <uploadId> [options]

Options:
  --url <url>            API Base URL (default: http://localhost:3000)
  --token <jwt>          JWT Auth Bearer token (default: reads DEV_TOKEN or mints via dev-token)
  --concurrency <n>      Parallel part upload concurrency (default: 4 per AC 18)
  --title <title>        Video title
  --resume <uploadId>    Resume an incomplete upload
  --abort <uploadId>     Abort an incomplete upload and mark abandoned
  --help                 Print this help
`);
}

export async function main(args: readonly string[], log: Logger): Promise<void> {
  const { file, flags } = parseArgs([...args]);

  if (flags.help || !(file || flags.abort)) {
    printHelp();
    return;
  }

  const apiBaseUrl = flags.url || process.env.API_BASE_URL || 'http://localhost:3000';
  const token = flags.token || process.env.AUTH_TOKEN || process.env.DEV_TOKEN || '';
  const concurrency = flags.concurrency ? Number.parseInt(flags.concurrency, 10) : 4;

  const client = new UploadClient({
    apiBaseUrl,
    token,
  });

  if (flags.abort) {
    await client.abortUpload(flags.abort);
    log.info({ uploadId: flags.abort }, 'upload aborted');
    return;
  }

  if (!fs.existsSync(file)) {
    log.error({ file }, 'file not found');
    process.exit(1);
  }

  log.info({ file, concurrency, apiBaseUrl, resuming: flags.resume }, 'upload starting');

  const result = await client.uploadFile({
    filePath: file,
    title: flags.title,
    concurrency,
    existingUploadId: flags.resume,
    onProgress: (completed, total) => {
      const pct = ((completed / total) * 100).toFixed(1);
      process.stderr.write(`\rprogress ${completed}/${total} parts (${pct}%)`);
    },
  });

  process.stderr.write('\n');
  log.info(
    { videoId: result.videoId, uploadId: result.uploadId, status: result.status },
    'upload completed'
  );
}

if (process.env.NODE_ENV !== 'test') {
  const log = createLogger({ service: 'upload-client', level: 'info', format: 'pretty' });
  main(process.argv.slice(2), log).catch((err) => {
    log.fatal({ err }, 'upload failed');
    process.exit(1);
  });
}
