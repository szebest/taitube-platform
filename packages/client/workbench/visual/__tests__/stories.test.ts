import { type StoryEntry, shotVariant, shotsFor, storiesFor } from '../stories';

const story = (id: string, importPath: string): StoryEntry => ({ id, type: 'story', importPath });

const BUTTON = story(
  'primitives-button--default',
  '../ui/src/button/__stories__/button.stories.tsx'
);
const CARD = story(
  'kit-video-card--default',
  '../../../apps/client/web/src/components/video/card/__stories__/card.stories.tsx'
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
      changed: ['packages/client/ui/src/button/button.variants.ts'],
      picked: [BUTTON],
    },
    {
      label: 'a change beside an app story',
      changed: ['apps/client/web/src/components/video/card/card.tsx'],
      picked: [CARD],
    },
    {
      label: 'a change in a subcomponent of a story',
      changed: ['apps/client/web/src/components/video/card/components/card-thumb/card-thumb.tsx'],
      picked: [CARD],
    },
    {
      label: 'a change in a sibling folder whose name starts like a story',
      changed: ['apps/client/web/src/components/video/card-grid/card-grid.tsx'],
      picked: [],
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

  it('shoots every theme and mode, on a pull request as on main', () => {
    const shots = shotsFor([BUTTON], { themes: ['sand', 'nocturne'], modes: ['dark', 'light'] });

    expect(shots.map(({ theme, mode }) => `${theme} ${mode}`)).toEqual([
      'sand dark',
      'sand light',
      'nocturne dark',
      'nocturne light',
    ]);
  });

  it.each([
    { tag: 'motion', extra: [{ motion: 'reduced' }] },
    { tag: 'text', extra: [{ direction: 'rtl' }] },
    { tag: 'translated', extra: [{ locale: 'pl' }] },
  ] as const)('shoots a $tag story once more at the first pair', ({ tag, extra }) => {
    const shots = shotsFor([{ ...BUTTON, tags: ['dev', tag] }, CARD], {
      themes: ['sand', 'nocturne'],
      modes: ['dark', 'light'],
      locales: ['pl'],
    });

    expect(shots.filter((shot) => shotVariant(shot) !== '')).toEqual(
      extra.map((variant) => ({ story: BUTTON.id, theme: 'sand', mode: 'dark', ...variant }))
    );
  });

  it.each([
    { shot: { motion: 'reduced' }, variant: '-reduced' },
    { shot: { direction: 'rtl' }, variant: '-rtl' },
    { shot: { locale: 'pl' }, variant: '-pl' },
    { shot: {}, variant: '' },
  ] as const)('names the $variant baseline', ({ shot, variant }) => {
    expect(shotVariant({ story: BUTTON.id, theme: 'sand', mode: 'dark', ...shot })).toBe(variant);
  });
});
