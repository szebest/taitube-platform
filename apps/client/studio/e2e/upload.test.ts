import { expect, FIXTURE_VIDEO, test } from '../../../../tests/playwright/fixtures';

const READY_TIMEOUT_MS = 120_000;

test.describe('upload', () => {
  test.setTimeout(READY_TIMEOUT_MS + 30_000);

  test('a signed-in creator uploads a video from the upload page, which links to it on the viewer app once READY', async ({
    page,
    signIn,
    api,
  }) => {
    const title = 'E2E browser upload';
    await signIn('creator');

    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_VIDEO);
    await page.getByLabel('Video title').fill(title);
    await page.getByLabel('Video visibility').click();
    await page.getByRole('option', { name: 'public' }).click();
    await page.getByRole('button', { name: 'upload', exact: true }).click();

    const videoLink = page.getByRole('link', { name: 'Go to the uploaded video page' });
    await expect(videoLink).toBeVisible();
    const href = await videoLink.getAttribute('href');
    expect(href).toMatch(/^http:\/\/localhost:5173\/watch\/[0-9a-f-]+$/);
    const videoId = href?.split('/').at(-1);

    const creator = await api('creator');
    const fetchVideo = async () => {
      const response = await creator.get(`/v1/videos/${videoId}`);
      return (await response.json()) as { status: string; posterUrl: string | null };
    };
    await expect
      .poll(async () => (await fetchVideo()).status, { timeout: READY_TIMEOUT_MS })
      .toBe('READY');
    expect((await fetchVideo()).posterUrl).toEqual(expect.any(String));
  });

  test('a signed-in creator edits the title of a video on the edit page', async ({
    page,
    signIn,
    api,
    stack,
  }) => {
    const { draft } = stack.videos;
    await signIn('creator');

    await page.goto(`/upload/edit/${draft.id}`);
    await expect(
      page.getByRole('heading', { name: `Editing video: ${draft.title}` })
    ).toBeVisible();
    await page.getByLabel('Video title').fill(`${draft.title} (edited)`);
    await page.getByRole('button', { name: 'upload', exact: true }).click();

    await expect(page.locator('[data-slot="toast-title"]')).toHaveText(
      'Successfully edited the video'
    );
    const creator = await api('creator');
    const response = await creator.get(`/v1/videos/${draft.id}`);
    expect(((await response.json()) as { title: string }).title).toBe(`${draft.title} (edited)`);
  });
});
