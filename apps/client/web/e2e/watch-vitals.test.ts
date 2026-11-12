import { expect, type Page, test } from '../../../../tests/playwright/fixtures';
import { CLS_BUDGET, observeVitals, readVitals } from '../../../../tests/playwright/vitals';
import { videoCard } from './video-card';

const COMMENT_COUNT = 12;

interface Transition {
  ready: boolean;
  groups: string[];
}

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
    api,
  }) => {
    const { id } = stack.videos.watchable;
    const { posterUrl } = await (await (await api()).get(`/v1/videos/${id}`)).json();
    await observeVitals(page);

    await page.goto(`/watch/${id}`);
    await page.waitForLoadState('networkidle');

    const { lcp } = await readVitals(page);
    test.info().annotations.push({ type: 'lcp', description: JSON.stringify(lcp) });
    expect(lcp?.url).toBe(posterUrl);
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
