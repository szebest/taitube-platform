import { expect, test } from './fixtures';

/** The dev server of the app under test hydrates: React's keys are on its buttons and the console is clean. */
export function describeDevHydration(): void {
  test.describe('the dev server', () => {
    test('hydrates the login page without a console error', async ({ page, devUrl }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(`${devUrl}/login`);

      const reactKeys = () =>
        page
          .getByRole('button')
          .first()
          .evaluate((button) =>
            Object.keys(button).filter((key) => key.startsWith('__reactFiber'))
          );
      await expect.poll(reactKeys, { timeout: 60_000 }).not.toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
