import { type Page, type Persona, type Stack, expect, test } from '../fixtures';

type HeaderedPage = {
  name: string;
  path: (stack: Stack) => string;
};

type HydratedFlow = {
  signIn?: Persona;
  path: (stack: Stack) => string;
  /** Waits for what the page shows once it is live and has navigated, however the app does it. */
  ready: (page: Page, stack: Stack) => Promise<void>;
};

export type SecurityHeadersSuite = {
  /** The server-rendered pages that must carry the headers; the first one also proves the nonce. */
  pages: readonly [HeaderedPage, ...HeaderedPage[]];
  hydrated: HydratedFlow;
};

/** The security headers suite every client app runs against its own origin. */
export function describeSecurityHeaders({ pages, hydrated }: SecurityHeadersSuite): void {
  test.describe('security headers on the server HTML', () => {
    for (const { name, path } of pages) {
      test(`${name} carries the security headers`, async ({ page, stack }) => {
        const response = await page.request.get(path(stack));
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

    test('the app hydrates and navigates without a policy violation', async ({
      page,
      stack,
      signIn,
    }) => {
      if (hydrated.signIn) await signIn(hydrated.signIn);
      const violations: string[] = [];
      page.on('console', (message) => {
        if (message.text().includes('Content Security Policy')) violations.push(message.text());
      });

      await page.goto(hydrated.path(stack));
      await hydrated.ready(page, stack);

      expect(violations).toEqual([]);
    });
  });

  test.describe('the nonce on the server HTML', () => {
    test.use({ javaScriptEnabled: false });

    test('every server-rendered script carries the nonce its response policy names', async ({
      page,
      stack,
    }) => {
      const response = await page.goto(pages[0].path(stack));
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
}
