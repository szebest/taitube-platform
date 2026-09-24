import * as path from 'node:path';
import { type Logger, createLogger } from '@vp/logger';
import { checkFixture, generateAllFixtures, loadManifest } from './generator';
import type { GeneratorOptions } from './types';

function parseArgs(args: string[]): { options: GeneratorOptions; check: boolean; help: boolean } {
  let outputDir = path.resolve(process.cwd(), 'tests/fixtures');
  let includeSlow = false;
  let only: string | undefined;
  let check = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output-dir' && args[i + 1]) {
      outputDir = path.resolve(process.cwd(), args[i + 1] as string);
      i++;
    } else if (arg === '--include-slow') {
      includeSlow = true;
    } else if (arg === '--only' && args[i + 1]) {
      only = args[i + 1];
      i++;
    } else if (arg === '--check') {
      check = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }

  return {
    options: { outputDir, includeSlow, only },
    check,
    help,
  };
}

type Generation =
  | { readonly type: 'done'; readonly generated: string[]; readonly errors: string[] }
  | { readonly type: 'failed'; readonly cause: unknown };

async function generate(options: GeneratorOptions, log: Logger): Promise<Generation> {
  try {
    const onFixture = (id: string) => log.info({ fixture: id }, 'generating fixture');
    return { type: 'done', ...(await generateAllFixtures(options, onFixture)) };
  } catch (cause) {
    return { type: 'failed', cause };
  }
}

function printHelp(): void {
  process.stdout.write(`
gen-video: Synthetic deterministic test-video generator for video-pipeline

Usage:
  pnpm gen-video [options]

Options:
  --output-dir <path>   Directory to output fixtures (default: tests/fixtures)
  --include-slow        Include slow/large fixtures (m10, l30, over-duration)
  --only <id>           Generate only a specific fixture by ID (e.g. s15, portrait)
  --check               Verify generated fixtures against manifest metadata
  --help, -h            Show this help message
`);
}

export async function main(args: readonly string[], log: Logger): Promise<void> {
  const { options, check, help } = parseArgs([...args]);

  if (help) {
    printHelp();
    return;
  }

  const manifest = loadManifest();

  if (check) {
    log.info({ outputDir: options.outputDir }, 'checking fixtures');
    const targets = manifest.fixtures.filter((f) => {
      if (options.only) return f.id === options.only;
      if (f.slow && !options.includeSlow) return false;
      return true;
    });

    let failedCount = 0;
    for (const fixture of targets) {
      const result = checkFixture(fixture, options.outputDir);
      const fields = { fixture: result.id, file: result.filename, detail: result.message };
      if (result.passed) {
        log.info(fields, 'fixture verified');
      } else {
        log.error(fields, 'fixture invalid or missing');
        failedCount++;
      }
    }

    if (failedCount > 0) {
      log.error({ failed: failedCount }, 'fixture verification failed');
      process.exit(1);
    }
    log.info({ checked: targets.length }, 'every fixture verified');
    return;
  }

  log.info({ outputDir: options.outputDir }, 'generating fixtures');
  const start = Date.now();
  const generation = await generate(options, log);
  if (generation.type === 'failed') {
    log.error({ err: generation.cause, outputDir: options.outputDir }, 'could not write fixtures');
    process.exit(1);
  }
  const { generated, errors } = generation;
  const seconds = (Date.now() - start) / 1000;

  log.info({ generated: generated.length, seconds }, 'fixtures generated');
  for (const error of errors) {
    log.error({ detail: error }, 'fixture not generated');
  }
  if (errors.length > 0) process.exit(1);
}

if (process.env['NODE_ENV'] !== 'test') {
  const log = createLogger({ service: 'gen-video', level: 'info', format: 'pretty' });
  main(process.argv.slice(2), log).catch((err) => {
    log.fatal({ err }, 'fixture generator failed');
    process.exit(1);
  });
}
