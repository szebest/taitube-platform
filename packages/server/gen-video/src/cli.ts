import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { checkFixture } from './check-fixture';
import { generateAllFixtures, selectFixtures } from './generator';
import { loadManifest } from './probe';
import type { GeneratorOptions } from './types';

function readArgs(argv: readonly string[]): {
  options: GeneratorOptions;
  check: boolean;
  help: boolean;
} {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      'output-dir': { type: 'string', default: 'tests/fixtures' },
      'include-slow': { type: 'boolean', default: false },
      only: { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  return {
    options: {
      outputDir: path.resolve(process.cwd(), values['output-dir']),
      includeSlow: values['include-slow'],
      only: values.only,
    },
    check: values.check,
    help: values.help,
  };
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

export interface CliHost {
  argv: readonly string[];
}

export async function run({ argv }: CliHost): Promise<void> {
  const { options, check, help } = readArgs(argv);

  if (help) {
    printHelp();
    return;
  }

  const manifest = loadManifest();

  if (check) {
    console.log(`[gen-video] Checking fixtures in ${options.outputDir}...`);
    const targets = selectFixtures(manifest, options);

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
      throw new Error(`verification failed: ${failedCount} fixture(s) invalid or missing`);
    }
    console.log(`\n[gen-video] All ${targets.length} checked fixtures verified successfully.`);
    return;
  }

  console.log(`[gen-video] Generating fixtures into ${options.outputDir}...`);
  const start = Date.now();
  const { generated, errors } = await generateAllFixtures(options);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[gen-video] Generated ${generated.length} fixture(s) in ${elapsed}s.`);
  if (errors.length > 0) {
    console.error(`[gen-video] Encountered ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    throw new Error(`${errors.length} fixture(s) failed to generate`);
  }
}
