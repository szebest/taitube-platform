import { type Persona, type Stack, expect, test } from './fixtures';

const NARROW_WIDTHS = [320, 375];

const widestBoxes = () => {
  const edge = document.documentElement.clientWidth;
  const past = [...document.body.querySelectorAll('*')]
    .map((element) => ({ element, right: Math.round(element.getBoundingClientRect().right) }))
    .filter(({ right }) => right > edge)
    .toSorted((a, b) => b.right - a.right)
    .slice(0, 3)
    .map(
      ({ element, right }) =>
        `${element.tagName.toLowerCase()}[${element.getAttribute('data-slot') ?? element.className}] to ${right}`
    );
  return { overflow: document.documentElement.scrollWidth - edge, past };
};

/** The narrow phone widths: no page of the list scrolls sideways, and the page names its widest box when one does. */
export function describeHorizontalOverflow(
  persona: Persona,
  paths: readonly (string | ((stack: Stack) => string))[],
  widths: readonly number[] = NARROW_WIDTHS
): void {
  test.describe('a viewport', () => {
    for (const width of widths) {
      test(`no page scrolls sideways at ${width} px`, async ({ page, signIn, stack }) => {
        await signIn(persona);
        await page.setViewportSize({ width, height: 800 });

        const overflowing: string[] = [];
        for (const path of paths) {
          const href = typeof path === 'string' ? path : path(stack);
          await page.goto(href, { waitUntil: 'networkidle' });
          const { overflow, past } = await page.evaluate(widestBoxes);
          if (overflow > 0) {
            overflowing.push(`${href} by ${overflow} px: ${past.join('; ')}`);
          }
        }
        expect(overflowing).toEqual([]);
      });
    }
  });
}
