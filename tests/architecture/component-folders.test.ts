import { posix } from 'node:path';
import { clientApps } from './client-apps';
import { trackedFiles } from './repo-files';

const PRIMITIVES = 'packages/client/ui/src/primitives/';
const COMPONENTS = 'packages/client/components/src/';

const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
/** Beside the required four: the compound context, the `tv()` styles, the narrowed unions, a sibling part. */
const OPTIONAL_FILE = new RegExp(`^(?:${KEBAB}(?:\\.context|\\.variants)?\\.tsx?|types\\.ts)$`);

const kitOf = (app: string) => `${app}/src/components/`;

/** The folder of each component: `primitives/<name>/`, an app kit's `<area>/<name>/`, or one holding an `index.ts` in `@vp/components`. */
function componentFolders(files: readonly string[], apps: readonly string[]): string[] {
  const atDepth = (root: string, depth: number) =>
    files
      .filter((file) => file.startsWith(root))
      .map((file) => file.slice(root.length).split('/'))
      .filter((parts) => parts.length > depth && parts[0] !== '__tests__')
      .map((parts) => `${root}${parts.slice(0, depth).join('/')}/`);
  const shared = files
    .filter((file) => file.startsWith(COMPONENTS) && file.endsWith('/index.ts'))
    .map((file) => `${posix.dirname(file)}/`)
    .filter((folder) => folder !== COMPONENTS);
  return [
    ...new Set([
      ...atDepth(PRIMITIVES, 1),
      ...shared,
      ...apps.flatMap((app) => atDepth(kitOf(app), 2)),
    ]),
  ];
}

function folderFindings(folder: string, files: readonly string[]): string[] {
  const name = posix.basename(folder);
  const inside = files
    .filter((file) => file.startsWith(folder))
    .map((file) => file.slice(folder.length));
  const required = [
    `${name}.tsx`,
    'index.ts',
    `${name}.stories.tsx`,
    `__tests__/${name}.dom.test.tsx`,
  ];
  const missing = required
    .filter((file) => !inside.includes(file))
    .map((file) => `${folder}: no ${file}`);
  const stray = inside
    .filter((file) => !(required.includes(file) || file.startsWith('__tests__/')))
    .filter((file) => !OPTIONAL_FILE.test(file))
    .map((file) => `${folder}: ${file} is not part of a component folder`);
  return [...missing, ...stray];
}

/** A source in a kit or `@vp/components` outside any component folder: specs and the barrel aside. */
function looseFiles(files: readonly string[], folders: readonly string[], apps: readonly string[]) {
  const roots = [PRIMITIVES, COMPONENTS, ...apps.map(kitOf)];
  return files
    .filter((file) => roots.some((root) => file.startsWith(root)))
    .filter((file) => !folders.some((folder) => file.startsWith(folder)))
    .filter((file) => !(file === `${COMPONENTS}index.ts` || file.includes('/__tests__/')))
    .map((file) => `${file} sits outside a component folder`);
}

function shapeFindings(files: readonly string[], apps: readonly string[]): string[] {
  const folders = componentFolders(files, apps);
  return [
    ...folders.flatMap((folder) => folderFindings(folder, files)),
    ...looseFiles(files, folders, apps),
  ];
}

const APP = 'apps/client/web';

/** The files `pnpm gen:component chip-bar --kind web` writes, under `folder`. */
const scaffold = (folder: string, name: string) => [
  `${folder}${name}.tsx`,
  `${folder}index.ts`,
  `${folder}${name}.stories.tsx`,
  `${folder}__tests__/${name}.dom.test.tsx`,
  `${folder}${name}.context.ts`,
  `${folder}${name}.variants.ts`,
  `${folder}types.ts`,
];

describe('architecture: every primitive and component has the folder shape', () => {
  it('passes a scaffolded folder in each home', () => {
    const files = [
      ...scaffold(`${PRIMITIVES}chip/`, 'chip'),
      ...scaffold(`${COMPONENTS}states/empty-state/`, 'empty-state'),
      ...scaffold(`${APP}/src/components/discovery/chip-bar/`, 'chip-bar'),
      `${COMPONENTS}index.ts`,
      `${COMPONENTS}__tests__/render-with-copy.tsx`,
    ];

    expect(shapeFindings(files, [APP])).toEqual([]);
  });

  it.each([
    {
      shape: 'a folder without its story and spec',
      files: [`${PRIMITIVES}chip/chip.tsx`, `${PRIMITIVES}chip/index.ts`],
      finding: `${PRIMITIVES}chip/: no chip.stories.tsx`,
    },
    {
      shape: 'a stylesheet in a component folder',
      files: [
        ...scaffold(`${APP}/src/components/watch/stage/`, 'stage'),
        `${APP}/src/components/watch/stage/stage.module.css`,
      ],
      finding: `${APP}/src/components/watch/stage/: stage.module.css is not part of a component folder`,
    },
    {
      shape: 'a nested folder',
      files: [
        ...scaffold(`${COMPONENTS}page-header/`, 'page-header'),
        `${COMPONENTS}page-header/parts/back.tsx`,
      ],
      finding: `${COMPONENTS}page-header/: parts/back.tsx is not part of a component folder`,
    },
    {
      shape: 'a component file loose in an app kit',
      files: [`${APP}/src/components/route-fallbacks.tsx`],
      finding: `${APP}/src/components/route-fallbacks.tsx sits outside a component folder`,
    },
  ])('fires on $shape', ({ files, finding }) => {
    expect(shapeFindings(files, [APP])).toContain(finding);
  });

  it('finds every primitive, shared component and app-kit component in its shape', () => {
    const apps = clientApps();
    const files = trackedFiles(PRIMITIVES, COMPONENTS, ...apps.map(kitOf));

    expect(shapeFindings(files, apps)).toEqual([]);
  });
});
