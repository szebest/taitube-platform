import { panelVariants } from '../panel';

describe('apps/web: panel', () => {
  it.each([
    { kind: 'menu', origin: 'tw:origin-(--radix-dropdown-menu-content-transform-origin)' },
    { kind: 'select', origin: 'tw:origin-(--radix-select-content-transform-origin)' },
  ] as const)('opens a $kind on the popover surface, from its trigger', ({ kind, origin }) => {
    const content = panelVariants({ kind }).content();

    expect(content.split(' ')).toEqual(expect.arrayContaining(['tw:bg-popover', origin]));
  });

  it('leaves a select row room on the right for its check', () => {
    expect(panelVariants({ kind: 'select' }).item().split(' ')).toContain('tw:pr-8');
  });

  it('highlights a destructive row in danger instead of the neutral tint', () => {
    const item = panelVariants({ kind: 'menu', variant: 'destructive' }).item().split(' ');

    expect(item).toContain('tw:data-highlighted:bg-danger/10');
    expect(item).not.toContain('tw:data-highlighted:bg-tint');
  });
});
