import { expect, type Page, test } from '../../../../tests/playwright/fixtures';
import { videoCard } from './video-card';

const COMMENT_COUNT = 12;
const CLS_BUDGET = 0.05;

type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type LargestPaint = PerformanceEntry & { element: Element | null; size: number };

interface Vitals {
  lcp: { slot: string | null; size: number } | undefined;
  cls: number;
}

interface Transition {
  ready: boolean;
  groups: string[];
}

const observeVitals = (page: Page) =>
  page.addInitScript(() => {
    const vitals: Vitals = { lcp: undefined, cls: 0 };
    Object.assign(window, { vitals });
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1) as LargestPaint;
      vitals.lcp = { slot: entry.element?.getAttribute('data-slot') ?? null, size: entry.size };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        if (!entry.hadRecentInput) {
          vitals.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

const readVitals = (page: Page) =>
  page.evaluate(() => (window as unknown as { vitals: Vitals }).vitals);

const recordTransitions = (page: Page) =>
  page.addInitScript(() => {
    const transitions: Transition[] = [];
    Object.assign(window, { transitions });
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      const transition = start(update);
      const record: Transition = { ready: false, groups: [] };
      transitions.push(record);
      transition.ready.then(
        () => {
          record.ready = true;
          record.groups = document
            .getAnimations()
            .map((animation) => (animation.effect as KeyframeEffect).pseudoElement ?? '')
            .filter((pseudo) => pseudo.startsWith('::view-transition-group('));
        },
        () => undefined
      );
      return transition;
    };
  });

const readTransitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { transitions: Transition[] }).transitions);

test.describe('watch vitals', () => {
  test('the poster is the largest contentful paint of the server render', async ({
    page,
    stack,
  }) => {
    await observeVitals(page);

    await page.goto(`/watch/${stack.videos.watchable.id}`);
    await page.waitForLoadState('networkidle');

    const { lcp } = await readVitals(page);
    test.info().annotations.push({ type: 'lcp', description: JSON.stringify(lcp) });
    expect(lcp?.slot).toBe('stage-poster');
  });

  test(`loading the discussion shifts the layout by less than ${CLS_BUDGET}`, async ({
    page,
    stack,
    api,
  }) => {
    const viewer = await api('viewer');
    for (let index = 0; index < COMMENT_COUNT; index++) {
      await viewer.post(`/v1/videos/${stack.videos.watchable.id}/comments`, {
        data: { content: `Vitals comment ${index}` },
      });
    }
    await observeVitals(page);

    await page.goto(`/watch/${stack.videos.watchable.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('region', { name: /^Discussion/ }).scrollIntoViewIfNeeded();
    await expect(page.getByText(/^Vitals comment \d+$/).first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    const { cls } = await readVitals(page);
    test.info().annotations.push({ type: 'cls', description: String(cls) });
    expect(cls).toBeLessThan(CLS_BUDGET);
  });
});

test.describe('watch view transition', () => {
  test('a card thumbnail morphs into the stage', async ({ page, stack }) => {
    const { id } = stack.videos.watchable;
    await recordTransitions(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await videoCard(page, id).click();
    await page.waitForURL(`**/watch/${id}`);

    await expect
      .poll(async () => (await readTransitions(page)).at(-1))
      .toMatchObject({
        ready: true,
        groups: expect.arrayContaining([`::view-transition-group(video-${id})`]),
      });
  });

  test('under reduced motion the navigation starts no view transition', async ({ page, stack }) => {
    const { id } = stack.videos.watchable;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await recordTransitions(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await videoCard(page, id).click();
    await page.waitForURL(`**/watch/${id}`);

    expect(await readTransitions(page)).toEqual([]);
  });
});
