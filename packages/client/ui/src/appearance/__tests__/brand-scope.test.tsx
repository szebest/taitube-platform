import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { serverRender } from '@vp/web-testing/server';
import type { ReactNode } from 'react';
import { BrandScope } from '../brand-scope';
import { type AppearancePreference, DEFAULT_APPEARANCE } from '../preference';
import { AppearanceProvider } from '../provider';

const NONCE = 'n0nce';

const renderScope = (color: string | null, preference: Partial<AppearancePreference> = {}) => {
  const rootRoute = createRootRoute({
    shellComponent: ({ children }: { children: ReactNode }) => (
      <AppearanceProvider
        stored={{ preference: { ...DEFAULT_APPEARANCE, ...preference }, source: 'appearance' }}
      >
        <BrandScope color={color}>
          <a href="/channel">Channel</a>
        </BrandScope>
        {children}
      </AppearanceProvider>
    ),
  });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <main>Page</main> }),
  ]);
  return serverRender(() => createRouter({ routeTree, ssr: { nonce: NONCE } }), '/');
};

describe('@vp/ui: BrandScope', () => {
  it.each(['#3366cc', '#FFFF00', '#fefefe', '#010101'])(
    'scopes the accent derived from %s to its subtree, under the request nonce',
    async (color) => {
      const { html } = await renderScope(color);
      const key = color.slice(1).toLowerCase();

      expect(html).toContain(`<div data-brand="${key}" class="contents">`);
      expect(html).toContain(`<style nonce="${NONCE}">`);
      expect(html).toContain(`[data-brand="${key}"] {`);
      expect(html).toContain('<a href="/channel">Channel</a>');
    }
  );

  it('sets the accent roles and no other', async () => {
    const { html } = await renderScope('#3366cc');
    const properties = new Set([...html.matchAll(/ {2}(--[a-z-]+):/g)].map(([, name]) => name));

    expect(properties).toEqual(
      new Set([
        '--accent',
        '--accent-hover',
        '--accent-soft',
        '--on-accent',
        '--accent-ink',
        '--focus-ring',
      ])
    );
  });

  it.each([
    { name: 'a channel with no brand colour', color: null, preference: {} },
    {
      name: 'a viewer with an accent of their own',
      color: '#3366cc',
      preference: { accent: '#aa2200' },
    },
    { name: 'a colour the engine cannot read', color: '#33', preference: {} },
  ])('renders the children as they are for $name', async ({ color, preference }) => {
    const { html } = await renderScope(color, preference);

    expect(html).toContain('<a href="/channel">Channel</a>');
    expect(html).not.toContain('data-brand');
    expect(html).not.toContain('<style');
  });
});
