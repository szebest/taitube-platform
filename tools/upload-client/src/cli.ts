#!/usr/bin/env node
import * as fs from 'node:fs';
import { UploadClient } from './client.js';

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
  console.log(`
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

export async function main(): Promise<void> {
  const { file, flags } = parseArgs(process.argv.slice(2));

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
    console.log(`[upload-client] Aborting upload ${flags.abort}...`);
    await client.abortUpload(flags.abort);
    console.log(`[upload-client] Upload ${flags.abort} aborted successfully.`);
    return;
  }

  if (!fs.existsSync(file)) {
    console.error(`Error: File not found at "${file}"`);
    process.exit(1);
  }

  console.log(
    `[upload-client] Starting upload of ${file} (concurrency: ${concurrency}, target: ${apiBaseUrl})...`
  );
  if (flags.resume) {
    console.log(`[upload-client] Resuming upload ${flags.resume}...`);
  }

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

if (process.argv[1]?.includes('cli')) {
  main().catch((err) => {
    console.error('[upload-client] Error:', err);
    process.exit(1);
  });
}
