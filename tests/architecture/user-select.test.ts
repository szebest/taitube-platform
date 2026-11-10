import { read, trackedFiles } from './repo-files';

const BASE = 'packages/client/ui/src/styles/base.css';

const VARIANTS = [
  ':(glob)packages/client/ui/src/primitives/*/*.variants.ts',
  ':(glob)packages/client/components/src/*/*.variants.ts',
];

/** A class that paints an element as a control: the pointer cursor and the touch handle, unprefixed. */
const CONTROL_CLASSES = ['cursor-pointer', 'touch-none'] as const;

/** The primitives that print chrome and are no control: each is named in the rule by its `data-slot`. */
const CHROME_SLOTS = ['avatar', 'badge', 'chip', 'kbd', 'label', 'tooltip-content'] as const;

const ROLES = ['button', 'tab', 'menuitem', 'option', 'switch', 'checkbox', 'radio', 'slider'];

function noneSelectors(css: string): string[] {
  const rule = /([^{}]+)\{[^{}]*\buser-select:\s*none/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  return (rule?.[1] ?? '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
}

const paintsControl = (source: string, className: string) =>
  new RegExp(`(?<=['"\`\\s])${className}(?=['"\`\\s])`).test(source);

/** The variants files that paint a control the rule does not list. */
function uncovered(
  selectors: readonly string[],
  files: Readonly<Record<string, string>>
): string[] {
  return Object.entries(files)
    .filter(([, source]) =>
      CONTROL_CLASSES.some(
        (className) => paintsControl(source, className) && !selectors.includes(`.${className}`)
      )
    )
    .map(([file]) => file);
}

const FIXTURE_RULE = `@layer base { button, [role="tab"], .cursor-pointer { user-select: none; } }`;
const FIXTURE_WITHOUT_CLASS = `@layer base { button, [role="tab"] { user-select: none; } }`;
const NEW_CONTROL = { 'toggle.variants.ts': "root: 'inline-flex cursor-pointer items-center'" };

describe('architecture: one user-select rule over chrome', () => {
  const selectors = noneSelectors(read(BASE));

  it('reads the rule from a stylesheet', () => {
    expect(noneSelectors(FIXTURE_RULE)).toEqual(['button', '[role="tab"]', '.cursor-pointer']);
  });

  it('fires on a control the rule does not list', () => {
    expect(uncovered(noneSelectors(FIXTURE_WITHOUT_CLASS), NEW_CONTROL)).toEqual([
      'toggle.variants.ts',
    ]);
  });

  it('leaves a control the rule lists, and a prefixed class, alone', () => {
    expect(uncovered(noneSelectors(FIXTURE_RULE), NEW_CONTROL)).toEqual([]);
    expect(uncovered([], { 'card.variants.ts': "root: '[a&,button&]:cursor-pointer' " })).toEqual(
      []
    );
  });

  it.each(ROLES)('lists the %s role', (role) => {
    expect(selectors).toContain(`[role="${role}"]`);
  });

  it.each(CHROME_SLOTS)('lists the %s slot', (slot) => {
    expect(selectors).toContain(`[data-slot="${slot}"]`);
  });

  it.each(['button', 'kbd', 'nav a'])('lists %s', (selector) => {
    expect(selectors).toContain(selector);
  });

  it('lists every control a shared variants file paints', () => {
    const files = trackedFiles(...VARIANTS);

    expect(files.length).toBeGreaterThan(30);
    expect(
      uncovered(selectors, Object.fromEntries(files.map((file) => [file, read(file)])))
    ).toEqual([]);
  });

  it('keeps the per-primitive select-none utility out of the shared packages', () => {
    const sources = trackedFiles(
      ':(glob)packages/client/ui/src/**/*.ts',
      ':(glob)packages/client/ui/src/**/*.tsx',
      ':(glob)packages/client/components/src/**/*.ts',
      ':(glob)packages/client/components/src/**/*.tsx',
      ':(exclude,glob)**/__tests__/**'
    );

    expect(sources.filter((file) => /(?<![\w-])select-none(?![\w-])/.test(read(file)))).toEqual([]);
  });
});
