import { panelVariants } from '../panel';

describe('@vp/ui: panel', () => {
  it('opens a select on the popover surface, from its trigger', () => {
    const content = panelVariants({ kind: 'select' }).content();

    expect(content.split(' ')).toEqual(
      expect.arrayContaining([
        'tw:bg-raised',
        'tw:origin-(--radix-select-content-transform-origin)',
      ])
    );
  });

  it('leaves a select row room on the right for its check', () => {
    expect(panelVariants({ kind: 'select' }).item().split(' ')).toContain('tw:pe-8');
  });
});
