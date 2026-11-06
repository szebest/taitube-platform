import { posix } from 'node:path';

/** Where Storybook runs, which `index.json`'s `importPath` is relative to. */
const WORKBENCH = 'packages/client/workbench';

/** A change under one of these can move every story's pixels, so it reruns them all. */
const EVERY_STORY = [
  'packages/universal/',
  'packages/server/vite-preset/',
  'packages/client/ui/src/styles/',
  'packages/client/ui/src/themes/',
  'packages/client/ui/src/tokens/',
  'packages/client/ui/src/appearance/',
  'packages/client/workbench/',
  'pnpm-lock.yaml',
];

/** The tag a story carries when it plays a motion, so the suite shoots it under the reduced set too. */
export const MOTION_TAG = 'motion';

/** The tag a story carries when it lays out text, so the suite shoots it right to left too. */
export const TEXT_TAG = 'text';

/** The tag a story carries when its words come from the catalogue, so the suite shoots it in every translation too. */
export const TRANSLATED_TAG = 'translated';

export type StoryEntry = Readonly<{
  id: string;
  type: string;
  importPath: string;
  tags?: readonly string[];
}>;

export type Shot = Readonly<{
  story: string;
  theme: string;
  mode: string;
  motion?: 'reduced';
  direction?: 'rtl';
  locale?: string;
}>;

const componentFolder = ({ importPath }: StoryEntry) =>
  posix.dirname(posix.dirname(posix.join(WORKBENCH, importPath)));

/**
 * The stories a change can move: all of them when no diff is given (main) or the diff touches the
 * universal packages, the vite preset, the tokens, themes, styles or the workbench; otherwise those
 * whose component folder (the parent of `__stories__/`) holds a changed file at any depth. Main with no story at all is an error, never a green run.
 */
export function storiesFor(
  entries: readonly StoryEntry[],
  changedFiles: readonly string[] | undefined
): StoryEntry[] {
  const stories = entries.filter(({ type }) => type === 'story');
  if (changedFiles === undefined && stories.length === 0) {
    throw new Error('the workbench index holds no story, so main would shoot nothing');
  }
  if (
    changedFiles === undefined ||
    changedFiles.some((file) => EVERY_STORY.some((prefix) => file.startsWith(prefix)))
  ) {
    return stories;
  }
  return stories.filter((story) =>
    changedFiles.some((file) => file.startsWith(`${componentFolder(story)}/`))
  );
}

/**
 * Every story at every theme and mode, on a pull request as on main, so a baseline a change is
 * missing fails its own pull request. At the first pair, a story tagged `motion` is shot once more
 * under the reduced motion set, one tagged `text` once right to left, and one tagged `translated`
 * once per translation.
 */
export function shotsFor(
  stories: readonly StoryEntry[],
  {
    themes,
    modes,
    locales = [],
  }: Readonly<{ themes: readonly string[]; modes: readonly string[]; locales?: readonly string[] }>
): Shot[] {
  const pairs = themes.flatMap((theme) => modes.map((mode) => ({ theme, mode })));
  const [first] = pairs;
  return stories.flatMap(({ id, tags = [] }) => [
    ...pairs.map((pair) => ({ story: id, ...pair })),
    ...(first !== undefined && tags.includes(MOTION_TAG)
      ? [{ story: id, ...first, motion: 'reduced' as const }]
      : []),
    ...(first !== undefined && tags.includes(TEXT_TAG)
      ? [{ story: id, ...first, direction: 'rtl' as const }]
      : []),
    ...(first !== undefined && tags.includes(TRANSLATED_TAG)
      ? locales.map((locale) => ({ story: id, ...first, locale }))
      : []),
  ]);
}

/** What sets a shot apart from the plain one at its theme and mode, as its baseline's name says it. */
export function shotVariant({ motion, direction, locale }: Shot): string {
  return [motion, direction, locale].map((part) => (part === undefined ? '' : `-${part}`)).join('');
}
