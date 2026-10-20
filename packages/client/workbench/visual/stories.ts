import { posix } from 'node:path';

/** Where Storybook runs, which `index.json`'s `importPath` is relative to. */
const WORKBENCH = 'packages/client/workbench';

/** A change under one of these can move every story's pixels, so it reruns them all. */
const EVERY_STORY = [
  'packages/universal/design-tokens/',
  'packages/client/ui/src/styles/',
  'packages/client/ui/src/themes/',
  'packages/client/ui/src/tokens/',
  'packages/client/ui/src/appearance/',
  'packages/client/workbench/',
  'pnpm-lock.yaml',
];

export type StoryEntry = Readonly<{ id: string; type: string; importPath: string }>;

export type Shot = Readonly<{ story: string; theme: string; mode: string }>;

const storyDirectory = ({ importPath }: StoryEntry) =>
  posix.dirname(posix.join(WORKBENCH, importPath));

/**
 * The stories a change can move: all of them when no diff is given (main) or the diff touches the
 * tokens, themes, styles or the workbench; otherwise those whose folder holds a changed file.
 */
export function storiesFor(
  entries: readonly StoryEntry[],
  changedFiles: readonly string[] | undefined
): StoryEntry[] {
  const stories = entries.filter(({ type }) => type === 'story');
  if (
    changedFiles === undefined ||
    changedFiles.some((file) => EVERY_STORY.some((prefix) => file.startsWith(prefix)))
  ) {
    return stories;
  }
  return stories.filter((story) =>
    changedFiles.some((file) => posix.dirname(file) === storyDirectory(story))
  );
}

/** Every story at every theme and mode on main; a pull request's at Sand dark and Nocturne light. */
export function shotsFor(
  stories: readonly StoryEntry[],
  {
    themes,
    modes,
    pullRequest,
  }: Readonly<{ themes: readonly string[]; modes: readonly string[]; pullRequest: boolean }>
): Shot[] {
  const pairs = pullRequest
    ? [
        { theme: 'sand', mode: 'dark' },
        { theme: 'nocturne', mode: 'light' },
      ]
    : themes.flatMap((theme) => modes.map((mode) => ({ theme, mode })));
  return stories.flatMap(({ id }) => pairs.map((pair) => ({ story: id, ...pair })));
}
