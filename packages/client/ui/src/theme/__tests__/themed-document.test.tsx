import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { serverRender } from '@vp/web-testing/server';
import type { ReactNode } from 'react';

import { SYSTEM_THEME_SCRIPT } from '../system-theme';
import type { ThemePreference } from '../theme-preference';
import { ThemedDocument } from '../themed-document';

function getRouter(preference: ThemePreference) {
  const rootRoute = createRootRoute({
    head: () => ({ meta: [{ title: 'Probe' }] }),
    shellComponent: ({ children }: { children: ReactNode }) => (
      <ThemedDocument preference={preference}>{children}</ThemedDocument>
    ),
  });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <main>Page</main> }),
  ]);
  return createRouter({ routeTree });
}

describe('@vp/ui: themed document', () => {
  it.each([
    { preference: 'light', theme: 'light', resolvesInHead: false },
    { preference: 'dark', theme: 'dark', resolvesInHead: false },
    { preference: 'system', theme: 'dark', resolvesInHead: true },
  ] as const)(
    'renders the $preference preference as data-theme $theme, resolved in the head: $resolvesInHead',
    async ({ preference, theme, resolvesInHead }) => {
      const { html } = await serverRender(() => getRouter(preference), '/');

      expect(html.startsWith(`<!DOCTYPE html><html lang="en" data-theme="${theme}"><head>`)).toBe(
        true
      );
      expect(html).toContain('<title>Probe</title>');
      expect(html).toContain('<main>Page</main>');
      expect(html.includes(`<script>${SYSTEM_THEME_SCRIPT}`)).toBe(resolvesInHead);
    }
  );
});
