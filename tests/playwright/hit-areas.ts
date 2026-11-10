import type { Locator } from '@playwright/test';

const GRID = 9;

/** Every point of a grid over `box` that lands on something a click does nothing with, as the element it lands on. */
export async function deadPoints(box: Locator): Promise<string[]> {
  return box.evaluate((element, grid) => {
    element.scrollIntoView({ block: 'center' });
    const { left, top, width, height } = element.getBoundingClientRect();
    const dead: string[] = [];
    for (let row = 0; row < grid; row++) {
      for (let column = 0; column < grid; column++) {
        const x = left + ((column + 0.5) / grid) * width;
        const y = top + ((row + 0.5) / grid) * height;
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('a[href], button, [role="button"], [role="link"], input, select')) {
          continue;
        }
        dead.push(
          `${Math.round(x)},${Math.round(y)} ${hit?.tagName.toLowerCase()}[${hit?.getAttribute('data-slot') ?? ''}]`
        );
      }
    }
    return dead;
  }, GRID);
}
