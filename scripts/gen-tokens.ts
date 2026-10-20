import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type TokenFiles, tokenFiles } from '../packages/universal/design-tokens/src/index';

const GENERATED_CSS = 'packages/client/ui/src/styles/generated';

const PATHS: Readonly<Record<keyof TokenFiles, string>> = {
  tokensJson: 'docs/design/tokens.json',
  themesCss: `${GENERATED_CSS}/themes.css`,
  setsCss: `${GENERATED_CSS}/sets.css`,
  tailwindThemeCss: `${GENERATED_CSS}/tailwind-theme.css`,
};

const args = process.argv.slice(2);
const check = args.includes('--check');
const root = resolve(args.find((arg) => arg !== '--check') ?? join(import.meta.dirname, '..'));

const readOrNothing = (path: string) => readFile(path, 'utf8').then(String, () => undefined);

// The registry, ramps and scale of `root`, so a scaffold into another tree generates that tree.
const fromRoot = (module: string) =>
  import(pathToFileURL(join(root, 'packages/client/ui/src', module)).href);
const [{ appearance }, { ramps }, { scale }] = await Promise.all([
  fromRoot('appearance/registry.ts'),
  fromRoot('tokens/ref/index.ts'),
  fromRoot('tokens/scale/index.ts'),
]);

const files = tokenFiles({ ...appearance, ref: ramps, scale });

if (!files.ok) {
  process.stderr.write(`gen:tokens: ${files.error.field}: ${files.error.message}\n`);
  process.exitCode = 1;
} else {
  const written = Object.entries(PATHS).map(([file, path]) => ({
    path,
    target: join(root, path),
    content: files.value[file as keyof TokenFiles],
  }));

  if (check) {
    const current = await Promise.all(written.map(({ target }) => readOrNothing(target)));
    const drifted = written.filter(({ content }, index) => current[index] !== content);
    if (drifted.length > 0) {
      process.stderr.write(
        `gen:tokens: ${drifted.map(({ path }) => path).join(', ')} drifted from the registry; run pnpm gen:tokens\n`
      );
      process.exitCode = 1;
    } else {
      process.stdout.write('gen:tokens: every generated file matches the registry\n');
    }
  } else {
    for (const { target, content } of written) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
      process.stdout.write(`wrote ${target}\n`);
    }
  }
}
