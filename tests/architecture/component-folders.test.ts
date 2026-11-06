import { posix } from 'node:path';
import { clientApps } from './client-apps';
import { trackedFiles } from './repo-files';

const PRIMITIVES = 'packages/client/ui/src/primitives/';
const COMPONENTS = 'packages/client/components/src/';

const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
/** Beside the required four: the compound context, the `tv()` styles, a lazy entry, the narrowed unions, the constants, a sibling part. */
const OPTIONAL_FILE = new RegExp(
  `^(?:${KEBAB}(?:\\.context|\\.variants|\\.lazy)?\\.tsx?|types\\.ts|constants\\.ts)$`
);
const HOOK_FILE = new RegExp(`^use-${KEBAB}\\.tsx?$`);
const UTIL_FILE = new RegExp(`^${KEBAB}\\.tsx?$`);

/** The player is shown by the pages that host it, so its folders carry no story. */
const PLAYER = /\/src\/components\/player\//;

/** Folders 131b moved down from a feature: each is shown by its host page's stories. */
const MOVED_DOWN: ReadonlySet<string> = new Set([
  'apps/client/studio/src/components/dialogs/version-conflict-dialog/',
  'apps/client/studio/src/components/table/load-more/',
  'apps/client/studio/src/components/video/video-status-badge/',
]);

const isStoryless = (folder: string) => PLAYER.test(folder) || MOVED_DOWN.has(folder);

/** Findings the tree still holds: each folder gets its index, story and spec, or leaves the kit. */
const PENDING = [
  'apps/client/studio/src/components/states/route-fallbacks/: no index.ts',
  'apps/client/studio/src/components/states/route-fallbacks/: no __stories__/route-fallbacks.stories.tsx',
  'apps/client/studio/src/components/states/route-fallbacks/: no __tests__/route-fallbacks.dom.test.tsx',
  'apps/client/web/src/components/player/control-bar/: no index.ts',
  'apps/client/web/src/components/player/taitube-preview/: no index.ts',
  'apps/client/web/src/components/states/route-fallbacks/: no index.ts',
  'apps/client/web/src/components/states/route-fallbacks/: no __stories__/route-fallbacks.stories.tsx',
  'apps/client/web/src/components/states/route-fallbacks/: no __tests__/route-fallbacks.dom.test.tsx',
];

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

/** Whether `file`, a path inside the folder of component `name`, belongs to its shape: a subcomponent under `components/` holds the same shape, without a story. */
function isPartOf(name: string, file: string, isRoot: boolean): boolean {
  const [head = '', ...rest] = file.split('/');
  const [next = '', ...deeper] = rest;
  if (rest.length === 0) return OPTIONAL_FILE.test(head);
  switch (head) {
    case '__tests__':
      return true;
    case '__stories__':
      return isRoot && file === `__stories__/${name}.stories.tsx`;
    case 'hooks':
      return next === '__tests__' || (deeper.length === 0 && HOOK_FILE.test(next));
    case 'utils':
      return next === '__tests__' || (deeper.length === 0 && UTIL_FILE.test(next));
    case 'components':
      return deeper.length > 0 && isPartOf(next, deeper.join('/'), false);
    default:
      return false;
  }
}

function folderFindings(folder: string, files: readonly string[]): string[] {
  const name = posix.basename(folder);
  const inside = files
    .filter((file) => file.startsWith(folder))
    .map((file) => file.slice(folder.length));
  const required = [
    `${name}.tsx`,
    'index.ts',
    ...(isStoryless(folder) ? [] : [`__stories__/${name}.stories.tsx`]),
    `__tests__/${name}.dom.test.tsx`,
  ];
  const missing = required
    .filter((file) => !inside.includes(file))
    .map((file) => `${folder}: no ${file}`);
  const stray = inside
    .filter((file) => !required.includes(file))
    .filter((file) => !isPartOf(name, file, true))
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
const STUDIO = 'apps/client/studio';

/** The files `pnpm gen:component chip-bar --kind web` writes, under `folder`. */
const scaffold = (folder: string, name: string) => [
  `${folder}${name}.tsx`,
  `${folder}index.ts`,
  `${folder}__stories__/${name}.stories.tsx`,
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
      `${APP}/src/components/discovery/chip-bar/hooks/use-chip-bar-overflow.ts`,
      `${APP}/src/components/discovery/chip-bar/hooks/__tests__/use-chip-bar-overflow.dom.test.tsx`,
      `${APP}/src/components/discovery/chip-bar/utils/chip-bar-track.ts`,
      `${APP}/src/components/discovery/chip-bar/components/chip-bar-skeleton/chip-bar-skeleton.tsx`,
      `${APP}/src/components/discovery/chip-bar/components/chip-bar-skeleton/__tests__/chip-bar-skeleton.dom.test.tsx`,
      `${STUDIO}/src/components/player/preview/preview.tsx`,
      `${STUDIO}/src/components/player/preview/index.ts`,
      `${STUDIO}/src/components/player/preview/__tests__/preview.dom.test.tsx`,
      `${COMPONENTS}index.ts`,
      `${COMPONENTS}__tests__/render-with-copy.tsx`,
    ];

    expect(shapeFindings(files, [APP, STUDIO])).toEqual([]);
  });

  it.each([
    {
      shape: 'a folder without its story and spec',
      files: [`${PRIMITIVES}chip/chip.tsx`, `${PRIMITIVES}chip/index.ts`],
      finding: `${PRIMITIVES}chip/: no __stories__/chip.stories.tsx`,
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
      shape: 'a story beside its component',
      files: [
        ...scaffold(`${STUDIO}/src/components/table/data-table/`, 'data-table'),
        `${STUDIO}/src/components/table/data-table/data-table-row.stories.tsx`,
      ],
      finding: `${STUDIO}/src/components/table/data-table/: data-table-row.stories.tsx is not part of a component folder`,
    },
    {
      shape: 'a story in a subcomponent',
      files: [
        ...scaffold(`${APP}/src/components/live/live-chat/`, 'live-chat'),
        `${APP}/src/components/live/live-chat/components/live-chat-list/__stories__/live-chat-list.stories.tsx`,
      ],
      finding: `${APP}/src/components/live/live-chat/: components/live-chat-list/__stories__/live-chat-list.stories.tsx is not part of a component folder`,
    },
    {
      shape: 'a hook not named use-*',
      files: [
        ...scaffold(`${STUDIO}/src/components/analytics/chart-frame/`, 'chart-frame'),
        `${STUDIO}/src/components/analytics/chart-frame/hooks/chart-theme.ts`,
      ],
      finding: `${STUDIO}/src/components/analytics/chart-frame/: hooks/chart-theme.ts is not part of a component folder`,
    },
    {
      shape: 'a component file loose in an app kit',
      files: [`${APP}/src/components/route-fallbacks.tsx`],
      finding: `${APP}/src/components/route-fallbacks.tsx sits outside a component folder`,
    },
  ])('fires on $shape', ({ files, finding }) => {
    expect(shapeFindings(files, [APP, STUDIO])).toContain(finding);
  });

  describe('over the tree', () => {
    const apps = clientApps();
    const findings = shapeFindings(trackedFiles(PRIMITIVES, COMPONENTS, ...apps.map(kitOf)), apps);

    it('finds every primitive, shared component and app-kit component in its shape', () => {
      expect(findings.filter((finding) => !PENDING.includes(finding))).toEqual([]);
    });

    it('still holds every pending finding, so a settled one leaves the list', () => {
      expect(PENDING.filter((finding) => !findings.includes(finding))).toEqual([]);
    });
  });
});
