import { expect, FIXTURE_VIDEO, test } from '../../../../tests/playwright/fixtures';

const READY_TIMEOUT_MS = 120_000;

test.describe('upload', () => {
  test.setTimeout(READY_TIMEOUT_MS + 30_000);

  test('a signed-in creator uploads a video from the dialog and follows it to READY in the widget', async ({
    page,
    signIn,
    api,
  }) => {
    const title = 'E2E browser upload';
    await signIn('creator');

    await page.goto('/upload');
    const dialog = page.getByRole('dialog', { name: 'Upload a video' });
    await dialog.locator('input[type="file"]').setInputFiles(FIXTURE_VIDEO);
    await dialog.getByRole('textbox', { name: 'Video title' }).fill(title);
    await dialog.getByRole('combobox', { name: 'Visibility' }).click();
    await page.getByRole('option', { name: 'Public' }).click();
    await dialog.getByRole('button', { name: 'Upload' }).click();

    const widget = page.getByRole('complementary', { name: 'Uploads' });
    await expect(widget.getByRole('progressbar', { name: `Overall of ${title}` })).toBeVisible();
    await page.getByRole('link', { name: 'Videos' }).first().click();
    await expect(widget).toBeVisible();

    const videoLink = widget.getByRole('link', { name: 'Watch on Taitube' });
    await expect(videoLink).toBeVisible({ timeout: READY_TIMEOUT_MS });
    const href = await videoLink.getAttribute('href');
    expect(href).toMatch(/^http:\/\/localhost:5173\/watch\/[0-9a-f-]+$/);
    const videoId = href?.split('/').at(-1);

    const creator = await api('creator');
    const response = await creator.get(`/v1/videos/${videoId}`);
    const { status, posterUrl } = (await response.json()) as {
      status: string;
      posterUrl: string | null;
    };
    expect(status).toBe('READY');
    expect(posterUrl).toEqual(expect.any(String));
  });

  test('a signed-in creator edits a video on the editor, reached from the old edit URL', async ({
    page,
    signIn,
    api,
    stack,
  }) => {
    const { draft } = stack.videos;
    await signIn('creator');

    await page.goto(`/upload/edit/${draft.id}`);
    await expect(page).toHaveURL(new RegExp(`/videos/${draft.id}/edit$`));
    await expect(
      page.getByRole('heading', { name: `Editing video: ${draft.title}` })
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Video title' }).fill(`${draft.title} (edited)`);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Changes saved');
    const creator = await api('creator');
    const response = await creator.get(`/v1/videos/${draft.id}`);
    expect(((await response.json()) as { title: string }).title).toBe(`${draft.title} (edited)`);
  });
});
