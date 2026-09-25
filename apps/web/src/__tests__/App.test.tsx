import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { stubBrowser } from './browser';

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

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(markup.includes('href="/trending"')).toBe(chrome);
  });
});
