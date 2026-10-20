import { type StoryEntry, shotsFor, storiesFor } from '../stories';

const story = (id: string, importPath: string): StoryEntry => ({ id, type: 'story', importPath });

const BUTTON = story('primitives-button--default', '../ui/src/button.stories.tsx');
const CARD = story(
  'kit-video-card--default',
  '../../../apps/client/web/src/components/video/card.stories.tsx'
);
const DOCS: StoryEntry = {
  id: 'primitives-button--docs',
  type: 'docs',
  importPath: BUTTON.importPath,
};
const ENTRIES = [BUTTON, CARD, DOCS];

describe('@vp/workbench: the stories a change can move', () => {
  it.each([
    { label: 'no diff (main)', changed: undefined, picked: [BUTTON, CARD] },
    {
      label: 'a change beside a story',
      changed: ['packages/client/ui/src/button.variants.ts'],
      picked: [BUTTON],
    },
    {
      label: 'a change beside an app story',
      changed: ['apps/client/web/src/components/video/card.tsx'],
      picked: [CARD],
    },
    {
      label: 'a theme change',
      changed: ['packages/client/ui/src/themes/sand/index.ts'],
      picked: [BUTTON, CARD],
    },
    {
      label: 'a universal package change',
      changed: ['packages/universal/messages/src/en/ui.ts'],
      picked: [BUTTON, CARD],
    },
    {
      label: 'a change no story sits beside',
      changed: ['apps/server/api/src/main.ts'],
      picked: [],
    },
  ])('picks for $label', ({ changed, picked }) => {
    expect(storiesFor(ENTRIES, changed)).toEqual(picked);
  });

  it('refuses main an index with no story, which would shoot nothing and pass', () => {
    expect(() => storiesFor([DOCS], undefined)).toThrow('holds no story');
  });

  it.each([
    {
      label: 'main: every theme and mode',
      pullRequest: false,
      pairs: ['sand dark', 'sand light', 'nocturne dark', 'nocturne light'],
    },
    {
      label: 'a pull request: Sand dark and Nocturne light',
      pullRequest: true,
      pairs: ['sand dark', 'nocturne light'],
    },
  ])('shoots $label', ({ pullRequest, pairs }) => {
    const shots = shotsFor([BUTTON], {
      themes: ['sand', 'nocturne'],
      modes: ['dark', 'light'],
      pullRequest,
    });

    expect(shots.map(({ theme, mode }) => `${theme} ${mode}`)).toEqual(pairs);
  });
});
