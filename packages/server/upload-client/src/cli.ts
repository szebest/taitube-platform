import * as fs from 'node:fs';
import { parseArgs } from 'node:util';
import { UploadClient } from './client';

type Env = Readonly<Record<string, string | undefined>>;

export interface CliHost {
  argv: readonly string[];
  env: Env;
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

function printHelp(): void {
  console.log(`
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

export async function run({ argv, env }: CliHost): Promise<void> {
  const { file, flags } = readArgs(argv);

  if (flags.help || !(file || flags.abort)) {
    printHelp();
    return;
  }

  const apiBaseUrl = flags.url || env.API_BASE_URL || 'http://localhost:3000';
  const token = flags.token || env.AUTH_TOKEN || env.DEV_TOKEN || '';
  const concurrency = Number.parseInt(flags.concurrency, 10);
  const client = new UploadClient({ apiBaseUrl, token });

  if (flags.abort) {
    console.log(`[upload-client] Aborting upload ${flags.abort}...`);
    await client.abortUpload(flags.abort);
    console.log(`[upload-client] Upload ${flags.abort} aborted successfully.`);
    return;
  }

  if (!(file && fs.existsSync(file))) throw new Error(`File not found at "${file}"`);

  console.log(
    `[upload-client] Starting upload of ${file} (concurrency: ${concurrency}, target: ${apiBaseUrl})...`
  );
  if (flags.resume) console.log(`[upload-client] Resuming upload ${flags.resume}...`);

  const result = await client.uploadFile({
    filePath: file,
    title: flags.title,
    concurrency,
    existingUploadId: flags.resume,
    onProgress: (completed, total) => {
      const pct = ((completed / total) * 100).toFixed(1);
      process.stdout.write(`\r[upload-client] Progress: ${completed}/${total} parts (${pct}%)`);
    },
  });

  console.log('');
  console.log('[upload-client] Upload completed successfully!');
  console.log(`  Video ID:  ${result.videoId}`);
  console.log(`  Upload ID: ${result.uploadId}`);
  console.log(`  Status:    ${result.status}`);
}
