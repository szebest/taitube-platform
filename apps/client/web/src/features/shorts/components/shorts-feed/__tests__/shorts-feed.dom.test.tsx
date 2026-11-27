import { fireEvent, screen, within } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, video } from '@vp/web-testing';
import { delay } from 'msw';
import { HttpResponse } from 'msw/http';
import { SHORTS } from '#app/__tests__/short-fixtures';
import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const feed = () => screen.getByRole('region', { name: 'Shorts player' });
const players = () => screen.getAllByTestId('player');
const sources = () => players().map((player) => player.getAttribute('data-src'));
const hlsOf = (position: number) => `http://localhost:9000/hls/${position}/master.m3u8`;

describe('apps/client/web: ShortsFeed', () => {
  it('is one region that takes focus when it opens, so the keys work at once', async () => {
    await renderShorts();

    expect(screen.getAllByRole('region', { name: 'Shorts player' })).toEqual([feed()]);
    expect(feed()).toHaveFocus();
  });

  it('snaps to one Short at a time, scrolling inside itself', async () => {
    await renderShorts();

    expect(feed()).toHaveClass(
      'snap-y',
      'snap-mandatory',
      'overflow-y-auto',
      'overscroll-contain',
      'touch-pan-y'
    );
    expect(feed().querySelector('[data-slot="shorts-slide"]')).toHaveClass(
      'snap-start',
      'snap-always'
    );
  });

  it('builds the player of the Short on screen and the next one, and no others', async () => {
    await renderShorts();

    expect(sources()).toEqual([hlsOf(1), hlsOf(2)]);
  });

  it('builds the one before and the one after the Short it opens on, and no others', async () => {
    await renderShorts({ path: `/shorts/${SHORTS[1]?.id}` });

    expect(sources()).toEqual([hlsOf(1), hlsOf(2), hlsOf(3)]);
  });

  it('plays the Short on screen and holds the ones beside it paused and muted', async () => {
    await renderShorts({ path: `/shorts/${SHORTS[1]?.id}` });

    expect(players().map((player) => [player.dataset.paused, player.dataset.muted])).toEqual([
      ['true', 'true'],
      ['false', 'true'],
      ['true', 'true'],
    ]);
  });

  it('moves to the next Short with the key, keeping the players of the Short it came from and the next', async () => {
    const { user } = await renderShorts();

    await user.keyboard('{ArrowDown}');

    expect(sources()).toEqual([hlsOf(1), hlsOf(2), hlsOf(3)]);
    expect(feed()).toBe(screen.getByRole('region', { name: 'Shorts player' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Short 2, by The Creator');
  });

  it.each([
    { key: '{ArrowDown}', from: 1, to: 2 },
    { key: 'j', from: 1, to: 2 },
    { key: '{ArrowUp}', from: 2, to: 1 },
    { key: 'k', from: 2, to: 1 },
  ])(
    'moves from Short $from to Short $to on $key from the first focus',
    async ({ key, from, to }) => {
      const { user } = await renderShorts({ path: `/shorts/${SHORTS[from - 1]?.id}` });

      await user.keyboard(key);

      expect(await screen.findByRole('status')).toHaveTextContent(`Short ${to}, by The Creator`);
    }
  );

  it.each([
    { key: ' ', attribute: 'paused', before: 'false', after: 'true' },
    { key: 'm', attribute: 'muted', before: 'true', after: 'false' },
    { key: 'c', attribute: 'captions', before: 'false', after: 'true' },
  ])('flips $attribute on "$key" and flips it back', async ({ key, attribute, before, after }) => {
    const { user } = await renderShorts();
    const [current] = players();

    await user.keyboard(key);
    expect(current?.dataset[attribute]).toBe(after);

    await user.keyboard(key);
    expect(current?.dataset[attribute]).toBe(before);
  });

  it('asks a guest who presses L to sign in to like', async () => {
    const { user } = await renderShorts();

    await user.keyboard('l');

    expect(await screen.findByRole('dialog', { name: 'Sign in to like this' })).toBeInTheDocument();
  });

  it('presses a focused button with Space and leaves the Short playing', async () => {
    const { user } = await renderShorts();
    const [current] = players();
    screen.getByRole('button', { name: 'Unmute' }).focus();

    await user.keyboard(' ');

    expect(current?.dataset.paused).toBe('false');
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('leaves the keys of a field to the field', async () => {
    const { user } = await renderShorts();
    const field = document.createElement('input');
    feed().append(field);
    field.focus();

    await user.keyboard('j');

    expect(screen.getByRole('status')).toHaveTextContent('Short 1');
  });

  it('plays the next Short from the start after a move, though the viewer paused this one', async () => {
    const { user } = await renderShorts();
    await user.keyboard(' ');

    await user.keyboard('{ArrowDown}');

    expect(players().find(({ dataset }) => dataset.src === hlsOf(2))?.dataset.paused).toBe('false');
  });

  it("keeps the viewer's mute across a move", async () => {
    const { user } = await renderShorts();
    await user.keyboard('m');

    await user.keyboard('{ArrowDown}');

    expect(players().find(({ dataset }) => dataset.src === hlsOf(2))?.dataset.muted).toBe('false');
  });

  it('holds the Short on screen as the only part of the feed a screen reader reaches', async () => {
    await renderShorts();

    const slides = feed().querySelectorAll('[data-slot="shorts-slide"]');
    expect([...slides].map((slide) => slide.getAttribute('aria-hidden'))).toEqual([
      null,
      'true',
      'true',
      'true',
    ]);
    expect(within(feed()).getAllByRole('group', { name: /Short/ })).toHaveLength(1);
  });

  it('says the viewer is caught up on the last Short', async () => {
    await renderShorts({ path: `/shorts/${SHORTS.at(-1)?.id}` });

    expect(screen.getByText('You are all caught up')).toBeInTheDocument();
  });

  it('preloads the posters of the next two Shorts', async () => {
    await renderShorts({ path: `/shorts/${SHORTS[0]?.id}` });

    expect(
      [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((link) =>
        link.getAttribute('href')
      )
    ).toEqual([SHORTS[1]?.posterUrl, SHORTS[2]?.posterUrl]);
  });

  it('keeps its players when a scroll event comes that moves nothing', async () => {
    await renderShorts();

    fireEvent.scroll(feed());

    expect(sources()).toEqual([hlsOf(1), hlsOf(2)]);
  });

  it('stays on the Short on screen when the URL names one the feed has not loaded', async () => {
    const unloaded = '0190c3a0-5e1d-7000-8000-0000000000ff';
    const { router } = await renderShorts({
      path: `/shorts/${SHORTS[1]?.id}`,
      handlers: [
        mockEndpoint(getVideo, ({ params }) =>
          String(params.id) === unloaded
            ? new HttpResponse(null, { status: 404 })
            : HttpResponse.json(video({ id: String(params.id), format: 'short' }))
        ),
      ],
    });

    await router.navigate({ to: '/shorts/$videoId', params: { videoId: unloaded } });

    await delay(300);

    expect(screen.getByRole('status')).toHaveTextContent('Short 2, by The Creator');
  });
});
