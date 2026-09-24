import * as fs from 'node:fs';
import { parseArgs } from 'node:util';
import type { Logger } from '@vp/logger';
import { UploadClient } from './client';

type Env = Readonly<Record<string, string | undefined>>;

export interface CliHost {
  argv: readonly string[];
  env: Env;
  print: (text: string) => void;
  log: Logger;
}

function readArgs(argv: readonly string[]) {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      token: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      title: { type: 'string' },
      resume: { type: 'string' },
      abort: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [file] = positionals;
  return { file, flags: values };
}

function printHelp(host: CliHost): void {
  host.print(`
@vp/upload-client — Reference resumable multipart upload client

Usage:
  pnpm upload-client <file> [options]
  pnpm upload-client --resume <uploadId> <file> [options]
  pnpm upload-client --abort <uploadId> [options]

Options:
  --url <url>            API Base URL (default: API_BASE_URL or http://localhost:3000)
  --token <jwt>          JWT Auth Bearer token (default: AUTH_TOKEN or DEV_TOKEN)
  --concurrency <n>      Parallel part upload concurrency (default: 4)
  --title <title>        Video title
  --resume <uploadId>    Resume an incomplete upload
  --abort <uploadId>     Abort an incomplete upload and mark abandoned
  --help, -h             Print this help
`);
}

export async function run(host: CliHost): Promise<void> {
  const { env, log } = host;
  const { file, flags } = readArgs(host.argv);

  if (flags.help || !(file || flags.abort)) {
    printHelp(host);
    return;
  }

  const apiBaseUrl = flags.url || env.API_BASE_URL || 'http://localhost:3000';
  const token = flags.token || env.AUTH_TOKEN || env.DEV_TOKEN || '';
  const concurrency = Number.parseInt(flags.concurrency, 10);
  const client = new UploadClient({ apiBaseUrl, token });

  if (flags.abort) {
    await client.abortUpload(flags.abort);
    log.info({ uploadId: flags.abort }, 'upload aborted');
    return;
  }

  if (!(file && fs.existsSync(file))) throw new Error(`File not found at "${file}"`);

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
