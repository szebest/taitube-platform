import * as path from 'node:path';
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
  | { readonly type: 'failed'; readonly reason: string };

async function generate(options: GeneratorOptions): Promise<Generation> {
  try {
    return { type: 'done', ...(await generateAllFixtures(options)) };
  } catch (cause) {
    return { type: 'failed', reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

function printHelp(): void {
  console.log(`
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

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const { options, check, help } = parseArgs([...args]);

  if (help) {
    printHelp();
    return;
  }

  const manifest = loadManifest();

  if (check) {
    console.log(`[gen-video] Checking fixtures in ${options.outputDir}...`);
    const targets = manifest.fixtures.filter((f) => {
      if (options.only) return f.id === options.only;
      if (f.slow && !options.includeSlow) return false;
      return true;
    });

    let failedCount = 0;
    for (const fixture of targets) {
      const result = checkFixture(fixture, options.outputDir);
      if (result.passed) {
        console.log(`  ✓ [${result.id}] ${result.filename}: ${result.message}`);
      } else {
        console.error(`  ✗ [${result.id}] ${result.filename}: ${result.message}`);
        failedCount++;
      }
    }

    if (failedCount > 0) {
      console.error(
        `\n[gen-video] Verification failed: ${failedCount} fixture(s) invalid or missing.`
      );
      process.exit(1);
    } else {
      console.log(`\n[gen-video] All ${targets.length} checked fixtures verified successfully.`);
    }
    return;
  }

  console.log(`[gen-video] Generating fixtures into ${options.outputDir}...`);
  const start = Date.now();
  const generation = await generate(options);
  if (generation.type === 'failed') {
    console.error(
      `[gen-video] Could not write fixtures into ${options.outputDir}: ${generation.reason}`
    );
    process.exit(1);
  }
  const { generated, errors } = generation;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[gen-video] Generated ${generated.length} fixture(s) in ${elapsed}s.`);
  if (errors.length > 0) {
    console.error(`[gen-video] Encountered ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    console.error('Fatal generator error:', err);
    process.exit(1);
  });
}
