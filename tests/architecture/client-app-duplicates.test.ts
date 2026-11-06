import { posix, relative } from 'node:path';
import { clientApps } from './client-apps';
import { read, trackedFiles } from './repo-files';

/**
 * TanStack Start and Router read these per app, by path, so every app carries its own however alike
 * they are; `server.ts` is the build's server entry, and a `*.lazy.ts` is one import path wrapped, which two apps may both need; `_authed.tsx` is the members-only layout, whose whole body is `@vp/queries`'s guard.
 */
const PER_APP_ENTRIES: ReadonlySet<string> = new Set([
  'src/router.tsx',
  'src/server.ts',
  'src/start.ts',
  'src/routes/_authed.tsx',
]);

/** Pairs of files at one path in two apps that differ by fewer than `NEAR_LINES` lines, per app. */
const NEAR_DUPLICATES: Readonly<Record<string, number>> = { studio: 5, web: 5 };

const NEAR_LINES = 10;

interface AppSource {
  app: string;
  /** The file's path inside its app. */
  path: string;
  content: string;
}

/** A file of nothing but `export * from` lines: the same barrel sits over any folder of pages. */
function isBarrel(content: string): boolean {
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .every((line) => /^export \* from '[^']+';$/.test(line));
}

function sourcesOf(app: string): AppSource[] {
  return trackedFiles(
    `:(glob)${app}/src/**/*.ts`,
    `:(glob)${app}/src/**/*.tsx`,
    `:(glob)${app}/src/**/*.css`,
    `:(glob)${app}/src/**/*.scss`
  )
    .map((file) => ({ app, path: relative(app, file), content: read(file) }))
    .filter(
      ({ path, content }) =>
        !(PER_APP_ENTRIES.has(path) || path.endsWith('.lazy.ts') || isBarrel(content))
    );
}

/** Every group of files, in two apps or more, whose bytes are the same: one line per group. */
function duplicatesAcross(sources: readonly AppSource[]): string[] {
  const byContent = new Map<string, AppSource[]>();
  for (const source of sources) {
    const same = byContent.get(source.content) ?? [];
    same.push(source);
    byContent.set(source.content, same);
  }
  return [...byContent.values()]
    .filter((same) => new Set(same.map(({ app }) => app)).size > 1)
    .map((same) => same.map(({ app, path }) => `${app}/${path}`).join(' = '));
}

/** The lines one text holds and the other does not, both ways: the edit distance of a line diff. */
function differingLines(left: string, right: string): number {
  const a = left.split('\n');
  const b = right.split('\n');
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const line of a) {
    const current = [0];
    b.forEach((other, index) => {
      current.push(
        line === other
          ? (previous[index] ?? 0) + 1
          : Math.max(previous[index + 1] ?? 0, current[index] ?? 0)
      );
    });
    previous = current;
  }
  const common = previous[b.length] ?? 0;
  return a.length + b.length - 2 * common;
}

/** Files at one path in two apps, not the same bytes, that differ by a few lines and share more than they differ. */
function nearDuplicatesAcross(sources: readonly AppSource[]): string[] {
  return sources.flatMap((left, index) =>
    sources
      .slice(index + 1)
      .filter(
        (right) =>
          right.app !== left.app && right.path === left.path && right.content !== left.content
      )
      .filter((right) => {
        const differing = differingLines(left.content, right.content);
        const shared =
          (left.content.split('\n').length + right.content.split('\n').length - differing) / 2;
        return differing < NEAR_LINES && shared > differing;
      })
      .map((right) => `${left.app}/${left.path} ~ ${right.app}/${right.path}`)
  );
}

describe('architecture: no source or spec file is copied between the client apps', () => {
  const apps = clientApps();

  it('reads every client app from its manifest', () => {
    expect(apps).toEqual(['apps/client/studio', 'apps/client/web']);
  });

  it('fires on a planted copy, and not on the same bytes twice in one app', () => {
    const planted = [
      { app: 'apps/client/web', path: 'src/hooks/use-thing.ts', content: 'export const a = 1;' },
      { app: 'apps/client/studio', path: 'src/features/thing.ts', content: 'export const a = 1;' },
      { app: 'apps/client/web', path: 'src/hooks/twice.ts', content: 'export const b = 2;' },
      { app: 'apps/client/web', path: 'src/hooks/again.ts', content: 'export const b = 2;' },
    ];

    expect(duplicatesAcross(planted)).toEqual([
      'apps/client/web/src/hooks/use-thing.ts = apps/client/studio/src/features/thing.ts',
    ]);
  });

  it.each([
    { file: 'a module', content: "export const a = 1;\nexport * from './b';", barrel: false },
    {
      file: 'a barrel',
      content: "export * from './pages';\nexport * from './hooks';\n",
      barrel: true,
    },
  ])('tells $file from a barrel', ({ content, barrel }) => {
    expect(isBarrel(content)).toBe(barrel);
  });

  it('still reads the sources and specs of each app, the Start entries and barrels aside', () => {
    const paths = apps.flatMap(sourcesOf).map(({ path }) => path);

    expect(paths).toContain('src/lib/config/index.ts');
    expect(paths).toContain('src/routes/__root.tsx');
    expect(paths).toContain('src/__tests__/providers.tsx');
    expect(paths).not.toContain('src/router.tsx');
    expect(paths).not.toContain('src/modules/Trending/index.ts');
  });

  it('finds no file under one client app byte-identical to one under another', () => {
    expect(duplicatesAcross(apps.flatMap(sourcesOf))).toEqual([]);
  });

  it.each([
    { change: 'one line changed', right: 'a\nb\nc\nd\nX\n', near: true },
    { change: 'ten lines changed', right: 'A\nB\nC\nD\nE\n', near: false },
  ])('reads a copy with $change as a near duplicate: $near', ({ right, near }) => {
    const planted = [
      { app: 'apps/client/web', path: 'src/lib/config/index.ts', content: 'a\nb\nc\nd\ne\n' },
      { app: 'apps/client/studio', path: 'src/lib/config/index.ts', content: right },
    ];

    expect(nearDuplicatesAcross(planted)).toEqual(
      near
        ? ['apps/client/web/src/lib/config/index.ts ~ apps/client/studio/src/lib/config/index.ts']
        : []
    );
  });

  it('holds the near duplicates between the apps at their number per app', () => {
    const pairs = nearDuplicatesAcross(apps.flatMap(sourcesOf));
    const counts = Object.fromEntries(
      apps.map((app) => [
        posix.basename(app),
        pairs.filter((pair) => pair.includes(`${app}/`)).length,
      ])
    );

    expect(counts).toEqual(NEAR_DUPLICATES);
  });
});
