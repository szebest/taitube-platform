import { declare, inFamily, rule, stylesheet, utilities } from '../rule';

const ruleFor = (declarations = [{ property: '--r-card', value: '10px' }]) =>
  rule('[data-radius="sharp"]', declarations);

describe('rule', () => {
  it('writes one declaration per line inside the selector', () => {
    expect(
      ruleFor([
        { property: '--r-card', value: '10px' },
        { property: '--r-chip', value: '6px' },
      ])
    ).toBe('[data-radius="sharp"] {\n  --r-card: 10px;\n  --r-chip: 6px;\n}');
  });

  it('writes nothing for a rule with no declarations', () => {
    expect(ruleFor([])).toBe('');
  });
});

describe('inFamily', () => {
  it.each([
    { family: 'dark', selector: ':is([data-mode="dark"], [data-mode="oled"])' },
    { family: 'light', selector: ':is([data-mode="light"])' },
  ] as const)('matches every mode of the $family family', ({ family, selector }) => {
    expect(inFamily(family)).toBe(selector);
  });
});

describe('stylesheet', () => {
  it('separates rules by a blank line, leaving out empty ones', () => {
    expect(stylesheet(['a {\n}', '', 'b {\n}'])).toBe('a {\n}\n\nb {\n}\n');
  });
});

describe('declare', () => {
  it('names each key and writes numbers as CSS text', () => {
    expect(
      declare({ base: 0, modal: 50 }, (layer) => ({
        property: `--z-${layer}`,
        utility: `--z-index-${layer}`,
      }))
    ).toEqual([
      { property: '--z-base', value: '0', utility: '--z-index-base' },
      { property: '--z-modal', value: '50', utility: '--z-index-modal' },
    ]);
  });
});

describe('utilities', () => {
  it('points each utility at its variable and leaves out a variable without one', () => {
    expect(
      utilities([
        { property: '--space-1', value: '4px' },
        { property: '--r-card', value: '10px', utility: '--radius-card' },
      ])
    ).toEqual([{ property: '--radius-card', value: 'var(--r-card)' }]);
  });
});
