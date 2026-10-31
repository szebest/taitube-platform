import { Shelf } from '@vp/components';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';

import { YouShelf } from '../you-shelf';

const render = (cards: boolean) =>
  renderPage(
    <YouShelf
      shelf="playlists"
      link={(label) => <a href="/feed/playlists">{label}</a>}
      action={{ label: 'Browse videos', link: (label) => <a href="/">{label}</a> }}
    >
      {cards ? [<Shelf.Item key="a">Road trips</Shelf.Item>] : []}
    </YouShelf>,
    AppProviders
  );

describe('apps/client/web: YouShelf', () => {
  it('names the shelf with a link to its page and lists the cards', async () => {
    const markup = await render(true);

    expect(markup).toMatch(/<h2[^>]*><a href="\/feed\/playlists">Playlists<\/a><\/h2>/);
    expect(markup).toContain('Road trips');
    expect(markup).not.toContain('Playlists you make show up here');
  });

  it('shows one line and one action in place of an empty row', async () => {
    const markup = await render(false);

    expect(markup).toContain('Playlists you make show up here');
    expect(markup).toMatch(/<a[^>]*href="\/"[^>]*>Browse videos<\/a>/);
    expect(markup).not.toContain('data-slot="shelf-track"');
  });
});
