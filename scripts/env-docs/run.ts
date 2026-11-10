import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  describeEnvKey,
  ENV_DOCS,
  ENV_GROUPS,
  EXTRA_ENV_DOCS,
  EXTRA_GROUPS,
} from '../../packages/server/env-schema/src/index';
import { buildModel } from './model';
import { parseEnvExample } from './parse-example';
import { renderEnvDocs } from './render';

const ENV_DOCS_FILE = 'docs/ENVIRONMENT.md';
const EXAMPLE_FILE = '.env.example';
const PLATFORM_FILE = 'packages/server/env-schema/src/platform-env.json';

const USAGE = `Usage: pnpm gen:env-docs [--check] [root]

Writes ${ENV_DOCS_FILE} from the environment schema, its ENV_DOCS registry, platform-env.json and
.env.example.

  --check   write nothing; exit 1 when ${ENV_DOCS_FILE} differs from what would be written
  --help    print this text

Exit codes: 0 up to date or written, 1 stale (--check), 2 bad arguments.
`;

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

const readOrNothing = (path: string): Promise<string | undefined> =>
  readFile(path, 'utf8').then(String, () => undefined);

export async function renderFor(root: string): Promise<string> {
  const [example, platform] = await Promise.all([
    readFile(join(root, EXAMPLE_FILE), 'utf8'),
    readFile(join(root, PLATFORM_FILE), 'utf8'),
  ]);
  return renderEnvDocs(
    buildModel({
      docs: ENV_DOCS,
      groups: ENV_GROUPS,
      describe: describeEnvKey,
      extraDocs: EXTRA_ENV_DOCS,
      extraGroups: EXTRA_GROUPS,
      platform: JSON.parse(platform),
      example: parseEnvExample(example),
    })
  );
}

export async function run(argv: readonly string[], defaultRoot: string): Promise<Outcome> {
  const flags = argv.filter((arg) => arg.startsWith('-'));
  const unknown = flags.filter((flag) => !['--check', '--help', '-h'].includes(flag));
  if (unknown.length > 0) {
    return { code: 2, stdout: '', stderr: `gen:env-docs: unknown option ${unknown[0]}\n${USAGE}` };
  }
  if (flags.includes('--help') || flags.includes('-h'))
    return { code: 0, stdout: USAGE, stderr: '' };

  const root = argv.find((arg) => !arg.startsWith('-')) ?? defaultRoot;
  const target = join(root, ENV_DOCS_FILE);
  const rendered = await renderFor(root);

  if (flags.includes('--check')) {
    if ((await readOrNothing(target)) === rendered) {
      return { code: 0, stdout: `gen:env-docs: ${ENV_DOCS_FILE} is up to date\n`, stderr: '' };
    }
    return {
      code: 1,
      stdout: '',
      stderr: `gen:env-docs: ${ENV_DOCS_FILE} is stale; run pnpm gen:env-docs and commit it\n`,
    };
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, rendered);
  return { code: 0, stdout: `wrote ${target}\n`, stderr: '' };
}
