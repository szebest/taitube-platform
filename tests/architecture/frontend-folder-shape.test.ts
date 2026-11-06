import { posix } from 'node:path';
import { clientApps } from './client-apps';
import { isSpec, trackedFiles } from './repo-files';

const PACKAGE_ROOTS = ['packages/client/ui/src/', 'packages/client/components/src/'];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Folders a tool names: specs, stories, Vitest's snapshots and module mocks. */
const TOOL_FOLDERS = new Set(['__tests__', '__stories__', '__snapshots__', '__mocks__']);

const FORBIDDEN_FOLDERS = new Set(['pages', 'modules', 'shared', 'common', 'misc']);

const STYLESHEET = /\.(?:css|scss|sass)$/;

/** Each file's breach of the folder shape, as `file: rule`; a file under no root is not read. */
function shapeFindings(files: readonly string[], appRoots: readonly string[]): string[] {
  const roots = [...appRoots, ...PACKAGE_ROOTS];
  return files.flatMap((file) => {
    const root = roots.find((candidate) => file.startsWith(candidate));
    if (root === undefined) return [];
    const folders = posix
      .dirname(file.slice(root.length))
      .split('/')
      .filter((part) => part !== '.');
    const inRoutes = appRoots.includes(root) && folders[0] === 'routes';
    return [
      ...folders
        .filter((folder) => FORBIDDEN_FOLDERS.has(folder))
        .map((folder) => `${file}: a ${folder}/ folder`),
      ...(inRoutes ? [] : folders)
        .filter((folder) => !(TOOL_FOLDERS.has(folder) || KEBAB.test(folder)))
        .map((folder) => `${file}: ${folder}/ is not kebab-case`),
      ...(file.endsWith('.stories.tsx') && folders.at(-1) !== '__stories__'
        ? [`${file}: a story outside __stories__/`]
        : []),
      ...(isSpec(file) && !folders.includes('__tests__')
        ? [`${file}: a spec outside __tests__/`]
        : []),
      ...(appRoots.includes(root) && STYLESHEET.test(file) && file !== `${root}styles/app.css`
        ? [`${file}: a stylesheet other than styles/app.css`]
        : []),
    ];
  });
}

const WEB = 'apps/client/web/src/';
const STUDIO = 'apps/client/studio/src/';

describe('architecture: every client app and component package keeps the folder shape', () => {
  it.each([
    `${WEB}features/browse/components/feed-card/feed-card.tsx`,
    `${WEB}features/browse/components/feed-card/__tests__/feed-card.dom.test.tsx`,
    `${WEB}components/video/card/__stories__/card.stories.tsx`,
    `${WEB}routes/_authed/$videoId.tsx`,
    `${WEB}routes/-components/watch-page/watch-page.tsx`,
    `${WEB}styles/app.css`,
    `${STUDIO}features/videos/hooks/__tests__/__snapshots__/use-update-video.dom.test.tsx.snap`,
    `${STUDIO}components/table/data-table/__stories__/data-table.stories.tsx`,
    'packages/client/ui/src/styles/index.css',
  ])('passes %s', (file) => {
    expect(shapeFindings([file], [WEB, STUDIO])).toEqual([]);
  });

  it.each([
    {
      file: `${WEB}features/watch/pages/watch-page.tsx`,
      finding: 'a pages/ folder',
    },
    {
      file: `${STUDIO}modules/upload/upload-page.tsx`,
      finding: 'a modules/ folder',
    },
    {
      file: `${STUDIO}features/shared/format.ts`,
      finding: 'a shared/ folder',
    },
    {
      file: `${WEB}features/videoActions/delete.ts`,
      finding: 'videoActions/ is not kebab-case',
    },
    {
      file: `${STUDIO}components/table/data-table/data-table.stories.tsx`,
      finding: 'a story outside __stories__/',
    },
    {
      file: 'packages/client/ui/src/primitives/button/button.stories.tsx',
      finding: 'a story outside __stories__/',
    },
    {
      file: `${STUDIO}features/upload/upload-video.test.ts`,
      finding: 'a spec outside __tests__/',
    },
    {
      file: `${WEB}features/watch/components/stage/stage.module.css`,
      finding: 'a stylesheet other than styles/app.css',
    },
    {
      file: `${STUDIO}studio.css`,
      finding: 'a stylesheet other than styles/app.css',
    },
  ])('fires on $file', ({ file, finding }) => {
    expect(shapeFindings([file], [WEB, STUDIO])).toEqual([`${file}: ${finding}`]);
  });

  it('holds over every client app, @vp/ui and @vp/components', () => {
    const appRoots = clientApps().map((app) => `${app}/src/`);
    const files = trackedFiles(...appRoots, ...PACKAGE_ROOTS);

    expect(files.some((file) => file.startsWith(STUDIO))).toBe(true);
    expect(shapeFindings(files, appRoots)).toEqual([]);
  });
});
