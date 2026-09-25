import { productionSources, read, trackedFiles } from './repo-files';

/**
 * The API returns a code and a wire-safe payload; the client chooses the words (SDD ADR-24). A
 * server source that imports the catalogues has started choosing wording, and the two sides drift.
 */
const SERVER_ROOTS = ['apps/api/', 'apps/worker/', 'packages/server/'];
const MESSAGES = /(?:from|import)\s*\(?\s*['"]@vp\/messages(?:\/[^'"]*)?['"]/;

function importsMessages(source: string): boolean {
  return MESSAGES.test(source);
}

function serverSources(): string[] {
  return productionSources().filter((file) => SERVER_ROOTS.some((root) => file.startsWith(root)));
}

function serverManifests(): string[] {
  return trackedFiles(...SERVER_ROOTS.map((root) => root.slice(0, -1))).filter((file) =>
    file.endsWith('/package.json')
  );
}

function declaresMessages(manifest: string): boolean {
  const parsed = JSON.parse(read(manifest)) as Record<string, Record<string, string> | undefined>;
  return ['dependencies', 'devDependencies', 'peerDependencies'].some(
    (group) => parsed[group]?.['@vp/messages'] !== undefined
  );
}

describe('architecture: @vp/messages stays out of every server package', () => {
  it.each([
    { shape: 'a static import', source: "import { en } from '@vp/messages';" },
    { shape: 'a dynamic import', source: "const m = await import('@vp/messages');" },
  ])('recognises $shape', ({ source }) => {
    expect(importsMessages(source)).toBe(true);
  });

  it('leaves the formatting core alone', () => {
    expect(importsMessages("import { createIntl } from '@vp/intl';")).toBe(false);
  });

  it('reads the server sources and manifests it is asserting about', () => {
    expect(serverSources().length).toBeGreaterThan(100);
    expect(serverManifests()).toContain('apps/api/package.json');
  });

  it('finds no server source importing it', () => {
    expect(serverSources().filter((file) => importsMessages(read(file)))).toEqual([]);
  });

  it('finds no server manifest declaring it', () => {
    expect(serverManifests().filter(declaresMessages)).toEqual([]);
  });
});
