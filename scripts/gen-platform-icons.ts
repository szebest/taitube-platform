import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const UI = 'packages/client/ui';
const OUT = `${UI}/src/icons/platform-icon-paths.generated.json`;
const MODULES = join(import.meta.dirname, '..', UI, 'node_modules');

const BRANDS = [
  ['github', 'simple-icons'],
  ['x', 'simple-icons'],
  ['instagram', 'simple-icons'],
  ['tiktok', 'simple-icons'],
  ['twitch', 'simple-icons'],
  ['discord', 'simple-icons'],
  ['mastodon', 'simple-icons'],
  ['bluesky', 'simple-icons'],
  ['reddit', 'simple-icons'],
  ['facebook', 'simple-icons'],
  ['linkedin', 'simple-icons-linkedin'],
] as const;

async function pathOf(slug: string, pkg: string): Promise<string> {
  const svg = await readFile(join(MODULES, pkg, 'icons', `${slug}.svg`), 'utf8');
  const match = /<path d="([^"]+)"/.exec(svg);
  if (!match?.[1]) throw new Error(`no path in ${pkg}/icons/${slug}.svg`);
  return match[1];
}

const paths = Object.fromEntries(
  await Promise.all(BRANDS.map(async ([slug, pkg]) => [slug, await pathOf(slug, pkg)] as const))
);
const source = `${JSON.stringify(paths, null, 2)}\n`;

const check = process.argv.includes('--check');
const existing = await readFile(OUT, 'utf8').catch(() => undefined);
if (check) {
  if (existing !== source) {
    process.stderr.write('platform icons are stale, run `pnpm gen:platform-icons`\n');
    process.exitCode = 1;
  }
} else {
  await writeFile(OUT, source);
}
