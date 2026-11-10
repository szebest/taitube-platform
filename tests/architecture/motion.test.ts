import { read, trackedFiles } from './repo-files';

const BASE = 'packages/client/ui/src/styles/base.css';

const VARIANTS = [
  ':(glob)packages/client/ui/src/primitives/*/*.variants.ts',
  ':(glob)packages/client/components/src/*/*.variants.ts',
];

const STYLESHEETS = [
  ':(glob)packages/client/*/src/**/*.css',
  ':(glob)apps/client/*/src/**/*.css',
  ':(glob)apps/client/*/src/**/*.scss',
];

/** A class that paints an element as a control: the pointer cursor and the touch handle, unprefixed. */
const CONTROL_CLASSES = ['cursor-pointer', 'touch-none'] as const;

const MOVES =
  /(?<![\w-])(?:[\w-]+:)*(?:animate-|motion-enter|transition-(?:transform|\[[^\]]*(?:translate|scale|rotate)))/;
const MOTION = /(?<![\w-])(?:[\w-]+:)*(?:transition|animate-|motion-enter)/;
const GUARD = /motion-reduce:|motion-safe:|motion-enter|in-data-\[motion=reduced\]/;

const paintsControl = (source: string) =>
  CONTROL_CLASSES.some((name) => new RegExp(`(?<=['"\`\\s])${name}(?=['"\`\\s])`).test(source));

/** The variants files that paint a control with no transition or animation at all. */
function standStill(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files)
    .filter(([, source]) => paintsControl(source) && !MOTION.test(source))
    .map(([file]) => file);
}

/** The variants files that move a control (transform, keyframes) with no `motion-reduce` guard. */
function unguarded(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files)
    .filter(([, source]) => paintsControl(source) && MOVES.test(source) && !GUARD.test(source))
    .map(([file]) => file);
}

/** The system setting read in a stylesheet: the media query itself, not the `motion-reduce` variant that wraps it. */
function reducedMotionQueries(css: string): number {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@custom-variant[\s\S]*?\n\}\n/g, '');
  return bare.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)?.length ?? 0;
}

const IDLE_CONTROL = { 'toggle.variants.ts': "root: 'inline-flex cursor-pointer items-center'" };
const MOVING_CONTROL = {
  'toggle.variants.ts': "root: 'inline-flex cursor-pointer items-center active:animate-pop-in'",
};
const GUARDED_CONTROL = {
  'toggle.variants.ts':
    "root: 'inline-flex cursor-pointer transition-transform motion-reduce:transition-none'",
};
const TWO_QUERIES = `@media (prefers-reduced-motion: reduce) { a { b: c } } @media (prefers-reduced-motion: reduce) { d { e: f } }`;
const CUSTOM_VARIANT = `@custom-variant motion-reduce {\n  @media (prefers-reduced-motion: reduce) {\n    @slot;\n  }\n}\n`;

describe('architecture: every control has motion, and motion respects the reduced set', () => {
  const files = Object.fromEntries(trackedFiles(...VARIANTS).map((file) => [file, read(file)]));

  it('fires on a control with no transition or animation', () => {
    expect(standStill(IDLE_CONTROL)).toEqual(['toggle.variants.ts']);
    expect(standStill(MOVING_CONTROL)).toEqual([]);
  });

  it('fires on a moving control with no motion-reduce guard', () => {
    expect(unguarded(MOVING_CONTROL)).toEqual(['toggle.variants.ts']);
    expect(unguarded(GUARDED_CONTROL)).toEqual([]);
  });

  it('counts the media query, not the variant that wraps it', () => {
    expect(reducedMotionQueries(TWO_QUERIES)).toBe(2);
    expect(reducedMotionQueries(CUSTOM_VARIANT)).toBe(0);
  });

  it('has a transition or an animation on every control a shared variants file paints', () => {
    expect(Object.keys(files).length).toBeGreaterThan(30);
    expect(standStill(files)).toEqual([]);
  });

  it('guards every move a shared control makes with motion-reduce', () => {
    expect(unguarded(files)).toEqual([]);
  });

  it('reads prefers-reduced-motion in one place, base.css, and nowhere else', () => {
    const sheets = trackedFiles(...STYLESHEETS);

    expect(reducedMotionQueries(read(BASE))).toBe(1);
    expect(
      sheets.filter((sheet) => reducedMotionQueries(read(sheet)) > 0 && sheet !== BASE)
    ).toEqual([]);
  });
});
