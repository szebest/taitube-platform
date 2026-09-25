import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../App';
import { stubBrowser } from './browser';

const route = vi.hoisted(() => ({ path: '/' }));

vi.mock(import('react-router-dom'), async (importOriginal) => {
  const router = await importOriginal();
  return {
    ...router,
    BrowserRouter: ({ children }: { children?: ReactNode }) => (
      <router.MemoryRouter initialEntries={[route.path]}>{children}</router.MemoryRouter>
    ),
  };
});

describe('apps/web: app', () => {
  it.each([
    { path: '/', chrome: true },
    { path: '/trending', chrome: true },
    { path: '/watch/any-video', chrome: true },
    { path: '/channel/any-channel', chrome: true },
    { path: '/subscriptions', chrome: false },
    { path: '/subscriptions/videos', chrome: false },
    { path: '/upload', chrome: false },
    { path: '/upload/edit/any-video', chrome: false },
  ])('gives a guest the layout at $path: $chrome', ({ path, chrome }) => {
    stubBrowser();
    route.path = path;

    const markup = renderToStaticMarkup(<App />);

    expect(markup.includes('href="/trending"')).toBe(chrome);
  });
});
