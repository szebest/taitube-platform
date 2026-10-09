import { expect, test, videoCard } from '../fixtures';

const PAGES = [
  { page: 'the home page', path: () => '/' },
  { page: 'a watch page', path: (videoId: string) => `/watch/${videoId}` },
];

test.describe('security headers on the server HTML', () => {
  for (const { page: name, path } of PAGES) {
    test(`${name} carries the security headers`, async ({ page, stack }) => {
      const response = await page.request.get(path(stack.videos.watchable.id));
      const headers = response.headers();

      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      const policy = headers['content-security-policy'] ?? '';
      expect(policy).toMatch(/script-src 'nonce-[\w+/=-]+' 'strict-dynamic'/);
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("base-uri 'self'");
    });
  }

  test('the app hydrates and navigates without a policy violation', async ({ page, stack }) => {
    const { watchable } = stack.videos;
    const violations: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('Content Security Policy')) violations.push(message.text());
    });

    await page.goto('/');
    await videoCard(page, watchable.id).click();

    await expect(page.getByRole('heading', { name: watchable.title })).toBeVisible();
    expect(violations).toEqual([]);
  });
});

test.describe('the nonce on the server HTML', () => {
  test.use({ javaScriptEnabled: false });

  test('every server-rendered script carries the nonce its response policy names', async ({
    page,
  }) => {
    const response = await page.goto('/');
    const policy = (await response?.allHeaders())?.['content-security-policy'] ?? '';

    const nonces = await page
      .locator('script')
      .evaluateAll((scripts) =>
        scripts.filter((script) => script instanceof HTMLScriptElement).map(({ nonce }) => nonce)
      );

    const [nonce] = nonces;
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(new Set(nonces)).toEqual(new Set([nonce]));
  });
});
