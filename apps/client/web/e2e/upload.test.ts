import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';

const FIXTURE = fileURLToPath(new URL('../../../../tests/fixtures/s2.mp4', import.meta.url));
const READY_TIMEOUT_MS = 120_000;

test.describe('upload', () => {
  test.setTimeout(READY_TIMEOUT_MS + 30_000);

  test('a signed-in creator uploads a video from the upload page and it reaches READY', async ({
    page,
    signIn,
    api,
  }) => {
    const title = 'E2E browser upload';
    await signIn('creator');

    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByLabel('Video title').fill(title);
    await page.getByLabel('Video visibility').selectOption('public');
    await page.getByRole('button', { name: 'upload', exact: true }).click();

    const videoLink = page.getByRole('link', { name: 'Go to the uploaded video page' });
    await expect(videoLink).toBeVisible();
    const videoId = (await videoLink.getAttribute('href'))?.split('/').at(-1);
    expect(videoId).toBeTruthy();

    const creator = await api('creator');
    const fetchVideo = async () => {
      const response = await creator.get(`/v1/videos/${videoId}`);
      return (await response.json()) as { status: string; posterUrl: string | null };
    };
    await expect
      .poll(async () => (await fetchVideo()).status, { timeout: READY_TIMEOUT_MS })
      .toBe('READY');
    expect((await fetchVideo()).posterUrl).toEqual(expect.any(String));

    await videoLink.click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });
});
