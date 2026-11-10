import { screen, waitFor, within } from '@testing-library/react';
import { getRelatedVideos } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import {
  QUEUED,
  renderPlaylistWatch,
  renderSeriesWatch,
  renderWatch,
} from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const RELATED_ID = '0190c3a0-5e1d-7000-8000-00000000a009';

const related = (...ids: string[]) =>
  mockEndpoint(getRelatedVideos, () =>
    HttpResponse.json({
      items: ids.map((id) => ({
        ...videoSummary({ id, title: id === VIDEO_ID ? 'Launch day' : 'Tram ride' }),
        reason: { kind: 'co-watched' as const },
      })),
    })
  );

const ROW_HEIGHT = 40;

describe('apps/client/web: watch queue', () => {
  it('holds the video on the stage alone, marked as playing, with its place in the queue', async () => {
    await renderWatch();

    const queue = screen.getByRole('region', { name: 'Your queue' });
    const items = within(within(queue).getByRole('list', { name: 'Your queue' })).getAllByRole(
      'listitem'
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    expect(within(queue).getByText('Now playing')).toBeInTheDocument();
    expect(within(queue).getByText('1 / 1')).toBeInTheDocument();
  });

  it('keeps a failed "More like this" to its own section, with a retry', async () => {
    const offline = mockEndpoint(getRelatedVideos, () => HttpResponse.error());
    const { user } = await renderWatch({ handlers: [offline] });

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('More like this could not be loaded');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your queue' })).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
  });

  it('lists the related videos under "More like this", leaving the video on the stage out', async () => {
    await renderWatch({ handlers: [related(VIDEO_ID, RELATED_ID)] });

    const more = await screen.findByRole('region', { name: 'More like this' });

    expect(within(more).getAllByRole('link')).toHaveLength(1);
    expect(within(more).getByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
  });

  it.each([
    { scenario: 'no related video', handler: related() },
    { scenario: 'only the video on the stage', handler: related(VIDEO_ID) },
  ])('has no "More like this" for $scenario', async ({ handler }) => {
    await renderWatch({ handlers: [handler] });

    expect(screen.queryByRole('region', { name: 'More like this' })).not.toBeInTheDocument();
  });

  it('shows an empty queue with a way back to browsing once the video is removed', async () => {
    const { user } = await renderWatch();

    await user.click(screen.getByRole('button', { name: 'Remove Launch day from the queue' }));

    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/');
  });

  it('opens a recommended video in the watch page', async () => {
    const { user } = await renderWatch({ handlers: [related(RELATED_ID)] });

    await user.click(await screen.findByRole('link', { name: 'Tram ride' }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('opens the first recommendation once the video ends', async () => {
    const { user, router } = await renderWatch({ handlers: [related(RELATED_ID)] });
    await screen.findByRole('link', { name: 'Tram ride' });
    const entries = router.history.length;

    await user.click(screen.getByRole('button', { name: 'End video' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${RELATED_ID}`));
    expect(router.history.length).toBe(entries + 1);
  });

  it('moves under the stage and beside the discussion in theater mode', async () => {
    const { user } = await renderWatch();
    const queue = () => screen.getByRole('region', { name: 'Your queue' });
    expect(queue()).not.toHaveAttribute('data-layout');

    await user.click(screen.getByRole('button', { name: 'Theater mode' }));

    expect(queue()).toHaveAttribute('data-layout', 'below');
  });

  it('renders the inline queue and a Queue button together, the breakpoint choosing between them', async () => {
    const { user } = await renderWatch();
    const trigger = screen.getByRole('button', { name: 'Queue' });
    const inline = screen.getByRole('region', { name: 'Your queue' });
    expect(trigger).toHaveClass('medium:hidden');
    expect(inline).toHaveClass('max-medium:hidden');

    await user.click(trigger);

    expect(
      within(await screen.findByRole('dialog')).getByRole('region', { name: 'Your queue' })
    ).toHaveAttribute('data-layout', 'sheet');
  });

  it('reorders a multi-video queue with the keyboard alone and announces each step', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const row = this.closest('li');
      const top = row ? [...(row.parentElement?.children ?? [])].indexOf(row) * ROW_HEIGHT : 0;
      return new DOMRect(0, top, 300, row ? ROW_HEIGHT : 0);
    });
    const { user } = await renderPlaylistWatch();
    const titles = () =>
      within(screen.getByRole('list', { name: 'Your queue' }))
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label'));
    await waitFor(() =>
      expect(titles()).toEqual(['Launch day', `Queued ${QUEUED[0]}`, `Queued ${QUEUED[1]}`])
    );

    screen.getByRole('button', { name: 'Reorder Launch day' }).focus();
    await user.keyboard('[Space]');
    expect(await screen.findByText('Picked up Launch day, position 1 of 3')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved to position 2')).toBeInTheDocument();
    await user.keyboard('[Space]');

    await waitFor(() =>
      expect(titles()).toEqual([`Queued ${QUEUED[0]}`, 'Launch day', `Queued ${QUEUED[1]}`])
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it.each([
    { before: 'Shuffle', after: 'Shuffle' },
    { before: 'Repeat off', after: 'Repeat all' },
  ])('turns on $before from the queue header', async ({ before, after }) => {
    const { user } = await renderWatch();
    const queue = within(screen.getByRole('region', { name: 'Your queue' }));

    await user.click(queue.getByRole('button', { name: before }));

    expect(queue.getByRole('button', { name: after })).toHaveAttribute('aria-pressed', 'true');
  });

  it('labels the queued entries of a series by episode, and those of a plain playlist by nothing', async () => {
    await renderSeriesWatch();

    const queue = screen.getByRole('region', { name: 'Your queue' });

    expect(await within(queue).findByText(/^Episode 1 ·/)).toBeInTheDocument();
    expect(within(queue).getByText(/^Episode 3 ·/)).toBeInTheDocument();
  });

  it('puts no episode number on the entries of a plain playlist', async () => {
    await renderPlaylistWatch();

    await screen.findByText(`Queued ${QUEUED[0]}`);

    expect(screen.queryByText(/^Episode/)).not.toBeInTheDocument();
  });
});
