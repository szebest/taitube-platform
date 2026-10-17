import { relative } from 'node:path';
import { clientApps } from './client-apps';
import { read, trackedFiles } from './repo-files';

/**
 * TanStack Start and Router read these per app, by path, so every app carries its own however alike
 * they are; `_authed.tsx` is the members-only layout, whose whole body is `@vp/queries`'s guard.
 */
const PER_APP_ENTRIES: ReadonlySet<string> = new Set([
  'src/router.tsx',
  'src/start.ts',
  'src/routes/_authed.tsx',
]);

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
    .filter(({ path, content }) => !(PER_APP_ENTRIES.has(path) || isBarrel(content)));
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

    expect(paths).toContain('src/config/index.ts');
    expect(paths).toContain('src/routes/__root.tsx');
    expect(paths).toContain('src/__tests__/providers.tsx');
    expect(paths).not.toContain('src/router.tsx');
    expect(paths).not.toContain('src/modules/Trending/index.ts');
  });

  it('finds no file under one client app byte-identical to one under another', () => {
    expect(duplicatesAcross(apps.flatMap(sourcesOf))).toEqual([]);
  });
});
