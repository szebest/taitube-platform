import { expect, serverHtml, test } from './fixtures';

test.describe('watch', () => {
  test('the server renders the watch page of a READY video', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    const html = await serverHtml(page, `/watch/${watchable.id}`);

    expect(html).toContain(`<title>${watchable.title}</title>`);
    expect(html).toContain(`>${watchable.title}</h4>`);
  });

  test('the watch page keeps the video once it hydrates', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    await page.goto(`/watch/${watchable.id}`);

    await expect(page).toHaveTitle(watchable.title);
    await expect(page.getByRole('heading', { name: watchable.title })).toBeVisible();
  });
});
