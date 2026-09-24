import * as path from 'node:path';
import { parseArgs } from 'node:util';
import type { Logger } from '@vp/logger';
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

function printHelp(host: CliHost): void {
  host.print(`
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
  print: (text: string) => void;
  log: Logger;
}

export async function run(host: CliHost): Promise<void> {
  const { log } = host;
  const { options, check, help } = readArgs(host.argv);

  if (help) {
    printHelp(host);
    return;
  }

  const manifest = loadManifest();

  if (check) {
    log.info({ outputDir: options.outputDir }, 'checking fixtures');
    const targets = selectFixtures(manifest, options);

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
      throw new Error(`verification failed: ${failedCount} fixture(s) invalid or missing`);
    }
    log.info({ checked: targets.length }, 'every fixture verified');
    return;
  }

  log.info({ outputDir: options.outputDir }, 'generating fixtures');
  const start = Date.now();
  const onFixture = (id: string) => log.info({ fixture: id }, 'generating fixture');
  const { generated, errors } = await generateAllFixtures(options, onFixture);
  const seconds = (Date.now() - start) / 1000;

  log.info({ generated: generated.length, seconds }, 'fixtures generated');
  for (const error of errors) {
    log.error({ detail: error }, 'fixture not generated');
  }
  if (errors.length > 0) {
    throw new Error(`${errors.length} fixture(s) failed to generate`);
  }
}
