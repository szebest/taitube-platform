import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMachine } from '../../packages/universal/machine/src/index';
import { findMachineFiles } from './discover';
import { buildModel, type LoadedMachine } from './model';
import { renderStateMachines } from './render';

const DOC_FILE = 'docs/state-machines.md';

const USAGE = `Usage: pnpm gen:state-machines [--check] [root]

Writes ${DOC_FILE} from every *.machine.ts under apps and packages.

  --check   write nothing; exit 1 when ${DOC_FILE} differs from what would be written
  --help    print this text

Exit codes: 0 up to date or written, 1 stale (--check), 2 bad arguments.
`;

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

const readOrNothing = async (path: string): Promise<string | undefined> =>
  existsSync(path) ? readFile(path, 'utf8') : undefined;

async function loadFile(root: string, file: string): Promise<LoadedMachine[]> {
  const exports: Record<string, unknown> = await import(pathToFileURL(join(root, file)).href);
  return Object.entries(exports).flatMap(([exportName, value]) =>
    isMachine(value) ? [{ file, exportName, machine: value }] : []
  );
}

export async function loadMachines(root: string): Promise<LoadedMachine[]> {
  const files = await findMachineFiles(root);
  const loaded = await Promise.all(files.map((file) => loadFile(root, file)));
  return loaded.flat();
}

export async function renderFor(root: string): Promise<string> {
  return renderStateMachines(buildModel(await loadMachines(root)));
}

export async function run(argv: readonly string[], defaultRoot: string): Promise<Outcome> {
  const flags = argv.filter((arg) => arg.startsWith('-'));
  const unknown = flags.filter((flag) => !['--check', '--help', '-h'].includes(flag));
  if (unknown.length > 0) {
    return {
      code: 2,
      stdout: '',
      stderr: `gen:state-machines: unknown option ${unknown[0]}\n${USAGE}`,
    };
  }
  if (flags.includes('--help') || flags.includes('-h'))
    return { code: 0, stdout: USAGE, stderr: '' };

  const root = argv.find((arg) => !arg.startsWith('-')) ?? defaultRoot;
  const target = join(root, DOC_FILE);
  const rendered = await renderFor(root);

  if (flags.includes('--check')) {
    if ((await readOrNothing(target)) === rendered) {
      return { code: 0, stdout: `gen:state-machines: ${DOC_FILE} is up to date\n`, stderr: '' };
    }
    return {
      code: 1,
      stdout: '',
      stderr: `gen:state-machines: ${DOC_FILE} is stale; run pnpm gen:state-machines and commit it\n`,
    };
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, rendered);
  return { code: 0, stdout: `wrote ${target}\n`, stderr: '' };
}
