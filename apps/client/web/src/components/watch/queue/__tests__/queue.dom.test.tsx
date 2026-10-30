import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { Queue, QueueSkeleton } from '..';
import type { QueueModesProps, QueueRootProps } from '../queue';

const ROW_HEIGHT = 40;

const VIDEOS = [
  { id: 'v1', title: 'Lisbon trams' },
  { id: 'v2', title: 'Alfama at 5 a.m.' },
  { id: 'v3', title: 'Rain on the Tagus' },
];

interface Setup extends Partial<QueueRootProps> {
  videos?: typeof VIDEOS;
  modes?: Partial<QueueModesProps>;
}

const renderQueue = ({ videos = VIDEOS, modes = {}, ...root }: Setup = {}) =>
  render(
    <AppProviders>
      <Queue.Root
        currentId="v2"
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        layout="side"
        {...root}
      >
        <Queue.Header
          position="2 / 3"
          modes={
            <Queue.Modes shuffle={false} repeat="off" autoplay onChange={vi.fn()} {...modes} />
          }
        >
          Your queue
        </Queue.Header>
        <Queue.List items={videos.map((video) => video.id)}>
          {videos.map((video) => (
            <Queue.Item key={video.id} id={video.id} title={video.title}>
              <a href={`/watch/${video.id}`}>{video.title}</a>
            </Queue.Item>
          ))}
        </Queue.List>
        <Queue.Recommendations heading="More like this">
          <a href="/watch/r1">Porto by night bus</a>
        </Queue.Recommendations>
      </Queue.Root>
    </AppProviders>
  );

describe('apps/client/web: Queue', () => {
  it('is a section with the queue and the recommendations as two labelled lists', () => {
    renderQueue();

    expect(screen.getByRole('region', { name: 'Your queue' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your queue' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'More like this' })).getByRole('list')
    ).toHaveTextContent('Porto by night bus');
  });

  it('marks the current item as now playing', () => {
    renderQueue();

    const current = screen.getByRole('listitem', { name: 'Alfama at 5 a.m.' });

    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current).toHaveTextContent('Now playing');
    expect(screen.getByRole('listitem', { name: 'Lisbon trams' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('removes an item from its button', async () => {
    const onRemove = vi.fn();
    renderQueue({ onRemove });

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Rain on the Tagus from the queue' })
    );

    expect(onRemove).toHaveBeenCalledWith('v3');
  });

  it.each([
    { key: '{Enter}', handler: 'onSelect' as const },
    { key: '{Delete}', handler: 'onRemove' as const },
  ])('calls $handler for $key on a focused row', async ({ key, handler }) => {
    const handlers = { onSelect: vi.fn(), onRemove: vi.fn() };
    renderQueue(handlers);
    screen.getByRole('listitem', { name: 'Lisbon trams' }).focus();

    await userEvent.keyboard(key);

    expect(handlers[handler]).toHaveBeenCalledWith('v1');
  });

  it('reports the move a keyboard drop made: Space picks up, an arrow moves, Space drops', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const row = this.closest('li');
      const top = row ? [...(row.parentElement?.children ?? [])].indexOf(row) * ROW_HEIGHT : 0;
      return new DOMRect(0, top, 300, row ? ROW_HEIGHT : 0);
    });
    const onReorder = vi.fn();
    renderQueue({ onReorder });
    screen.getByRole('button', { name: 'Reorder Rain on the Tagus' }).focus();

    await userEvent.keyboard('[Space]');
    await userEvent.keyboard('[ArrowUp]');
    await userEvent.keyboard('[Space]');

    const [[id, toIndex]] = onReorder.mock.calls as [[string, number]];
    const rest = ['v1', 'v2', 'v3'].filter((video) => video !== id);
    rest.splice(toIndex, 0, id);

    expect(onReorder).toHaveBeenCalledOnce();
    expect(rest).toEqual(['v1', 'v3', 'v2']);
  });

  it('hides the handles for a single item', () => {
    renderQueue({ videos: VIDEOS.slice(0, 1), currentId: 'v1' });

    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
  });

  it.each([
    { repeat: 'off' as const, name: 'Repeat off', next: 'all' },
    { repeat: 'all' as const, name: 'Repeat all', next: 'one' },
    { repeat: 'one' as const, name: 'Repeat one', next: 'off' },
  ])('cycles repeat from $repeat to $next', async ({ repeat, name, next }) => {
    const onChange = vi.fn();
    renderQueue({ modes: { repeat, onChange } });

    await userEvent.click(screen.getByRole('button', { name }));

    expect(onChange).toHaveBeenCalledWith({ shuffle: false, repeat: next, autoplay: true });
  });

  it('toggles shuffle and autoplay', async () => {
    const onChange = vi.fn();
    renderQueue({ modes: { onChange } });

    await userEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Autoplay' }));

    expect(onChange).toHaveBeenNthCalledWith(1, { shuffle: true, repeat: 'off', autoplay: true });
    expect(onChange).toHaveBeenNthCalledWith(2, { shuffle: false, repeat: 'off', autoplay: false });
  });

  it('opens the queue in a drawer in the sheet layout', async () => {
    renderQueue({ layout: 'sheet' });

    await userEvent.click(screen.getByRole('button', { name: 'Queue' }));

    expect(await screen.findByRole('dialog', { name: 'Queue' })).toBeInTheDocument();
  });

  it('keeps the inline queue beside a drawer button when collapsible, each hidden by its own breakpoint', () => {
    renderQueue({ layout: undefined, collapsible: true });

    expect(screen.getByRole('button', { name: 'Queue' })).toHaveClass('tw:medium:hidden');
    expect(screen.getByRole('region', { name: 'Your queue' })).toHaveClass('tw:max-medium:hidden');
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderQueue();
    render(<QueueSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
