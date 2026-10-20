import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { expectOk } from '@vp/testing/result';
import { serverRender } from '@vp/web-testing/server';
import type { ReactNode } from 'react';
import { nocturne } from '../../themes/nocturne';
import { type AppearancePreference, DEFAULT_APPEARANCE } from '../preference';
import { registerTheme } from '../register-theme';
import { ThemedDocument, type ThemedDocumentProps } from '../themed-document';

const NONCE = 'n0nce';

const renderDocument = (
  preference: Partial<AppearancePreference>,
  props: Partial<ThemedDocumentProps> = {}
) => {
  const rootRoute = createRootRoute({
    shellComponent: ({ children }: { children: ReactNode }) => (
      <ThemedDocument
        stored={{ preference: { ...DEFAULT_APPEARANCE, ...preference }, source: 'appearance' }}
        {...props}
      >
        {children}
      </ThemedDocument>
    ),
  });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <main>Page</main> }),
  ]);
  return serverRender(() => createRouter({ routeTree, ssr: { nonce: NONCE } }), '/');
};

const htmlTag = (html: string) =>
  html.slice(html.indexOf('<html'), html.indexOf('>', html.indexOf('<html')) + 1);

describe('@vp/ui: ThemedDocument', () => {
  it('server-renders the theme, mode, contrast and every token group from the cookie on <html>', async () => {
    const { html } = await renderDocument({
      theme: 'nocturne',
      mode: 'oled',
      contrast: 'more',
      overrides: { fontSize: 'large' },
    });

    expect(htmlTag(html)).toBe(
      '<html lang="en" data-theme="nocturne" data-mode="oled" data-contrast="more" data-typography="geist" data-font-size="large" data-spacing="default" data-sizing="medium" data-radius="sharp" data-border="regular" data-shadow="flat" data-ambient="subtle" data-motion="standard">'
    );
    expect(html).toContain('<main>Page</main>');
  });

  it.each([
    { mode: 'system', settlesTheMode: true },
    { mode: 'light', settlesTheMode: false },
  ] as const)(
    'settles a $mode mode before paint: $settlesTheMode',
    async ({ mode, settlesTheMode }) => {
      const { html } = await renderDocument({ mode });

      expect(html).toContain(`<script nonce="${NONCE}">`);
      expect(html.includes('prefers-color-scheme: light')).toBe(settlesTheMode);
      expect(html).toContain('prefers-reduced-motion: reduce');
    }
  );

  it('inlines the accent override and registered themes under the request nonce', async () => {
    const registered = expectOk(registerTheme({ ...nocturne, id: 'dusk', name: 'Dusk' }, null));

    const { html } = await renderDocument(
      { theme: 'dusk', accent: '#3D6595' },
      { registered: [registered] }
    );

    expect(htmlTag(html)).toContain('data-theme="dusk"');
    expect(html).toContain(`<style nonce="${NONCE}">[data-theme="dusk"] {`);
    expect(html).toContain(`<style nonce="${NONCE}">:root[data-theme]`);
  });
});
