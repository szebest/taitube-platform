import { inFamily, rule, stylesheet } from '../rule';

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
