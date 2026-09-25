export type Command =
  | { type: 'pnpm'; script: string; filter: string | undefined }
  | { type: 'make'; target: string };

/** pnpm's own commands: running one of these names no script. */
const PNPM_BUILTINS = new Set([
  'add',
  'audit',
  'config',
  'create',
  'deploy',
  'dlx',
  'exec',
  'i',
  'install',
  'list',
  'ls',
  'outdated',
  'prune',
  'remove',
  'store',
  'update',
  'why',
]);

const COMMAND_SEPARATORS = /&&|\|\||[;|()`]|\$\(/;

function isPlaceholder(word: string): boolean {
  return word.includes('<') || word.includes('…') || word.includes('$');
}

function pnpmCommand(words: readonly string[]): Command | undefined {
  let filter: string | undefined;
  let index = 0;
  while ((words[index] ?? '').startsWith('-')) {
    const flag = words[index];
    index += 1;
    if (flag === '--filter' || flag === '-F') {
      filter = words[index];
      index += 1;
    }
  }
  let script = words[index];
  if (script === 'run') script = words[index + 1];
  if (script === undefined || isPlaceholder(script) || PNPM_BUILTINS.has(script)) return undefined;
  return { type: 'pnpm', script, filter };
}

function makeCommand(words: readonly string[]): Command | undefined {
  const isOptionOrVariable = (word: string) => word.startsWith('-') || word.includes('=');
  const target = words.find((word) => !isOptionOrVariable(word));
  if (target === undefined || isPlaceholder(target)) return undefined;
  return { type: 'make', target };
}

function withoutComment(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('#')) return '';
  const commentAt = trimmed.indexOf(' #');
  return commentAt === -1 ? trimmed : trimmed.slice(0, commentAt);
}

/** The command a shell part runs, once any `NAME=value` prefix is read past. */
function commandOf(part: string): Command | undefined {
  const words = part.trim().split(/\s+/);
  const start = words.findIndex((word) => !word.includes('='));
  const [program, ...rest] = words.slice(start);
  if (program === 'pnpm') return pnpmCommand(rest);
  if (program === 'make') return makeCommand(rest);
  return undefined;
}

/** Every `pnpm <script>` and `make <target>` run in a code span or block. */
export function commandsIn(text: string): Command[] {
  return text
    .split('\n')
    .map(withoutComment)
    .flatMap((line) => line.split(COMMAND_SEPARATORS))
    .map(commandOf)
    .filter((command) => command !== undefined);
}

/** Every rule the Makefile defines, read the way `make help` reads them: `name:` at column 0. */
export function makeTargets(makefile: string): string[] {
  return makefile
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):(?!=)/.exec(line)?.[1])
    .filter((target) => target !== undefined);
}

export function phonyTargets(makefile: string): string[] {
  const phony = makefile.split('\n').find((line) => line.startsWith('.PHONY:'));
  return (phony ?? '').replace('.PHONY:', '').trim().split(/\s+/).filter(Boolean);
}
