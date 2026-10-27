import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { Shelf, ShelfSkeleton, shelfStyles } from '..';
import type { ShelfRootProps } from '../shelf';

const TRACK_WIDTH = 300;
const CONTENT_WIDTH = 1000;

const renderShelf = (props: ShelfRootProps = {}) =>
  render(
    <AppProviders>
      <Shelf.Root {...props}>
        <Shelf.Header>
          <Shelf.Title>From channels you follow</Shelf.Title>
          <Shelf.Note>Picked by the night shift</Shelf.Note>
          <Shelf.Action asChild>
            <a href="/feed/subscriptions">See all</a>
          </Shelf.Action>
        </Shelf.Header>
        <Shelf.Track>
          {['Tram ride', 'Fado night', 'Harbour lights'].map((title) => (
            <Shelf.Item key={title}>
              <a href="/watch">{title}</a>
            </Shelf.Item>
          ))}
        </Shelf.Track>
      </Shelf.Root>
    </AppProviders>
  );

const overflowing = () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(TRACK_WIDTH);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(CONTENT_WIDTH);
};

const track = () => screen.getByRole('list', { name: 'From channels you follow' });
const chevron = (name: string) => screen.getByRole('button', { name, hidden: true });

describe('apps/client/web: Shelf', () => {
  it('names the section and its track by the heading', () => {
    renderShelf();

    expect(screen.getByRole('region', { name: 'From channels you follow' })).toContainElement(
      track()
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/feed/subscriptions'
    );
  });

  it('shows no chevrons when every item fits', () => {
    renderShelf();

    expect(chevron('Scroll back')).toHaveAttribute('data-hidden');
    expect(chevron('Scroll forward')).toHaveAttribute('data-hidden');
  });

  it.each([
    { scrolled: 0, back: true, forward: false },
    { scrolled: 300, back: false, forward: false },
    { scrolled: 700, back: false, forward: true },
  ])('hides the chevron of an edge reached after $scrolled px', ({ scrolled, back, forward }) => {
    overflowing();
    renderShelf();

    track().scrollLeft = scrolled;
    fireEvent.scroll(track());

    expect(chevron('Scroll back').hasAttribute('data-hidden')).toBe(back);
    expect(chevron('Scroll forward').hasAttribute('data-hidden')).toBe(forward);
  });

  it('scrolls most of a screen forward from the end chevron', async () => {
    overflowing();
    renderShelf();
    const scrollBy = vi.fn();
    track().scrollBy = scrollBy;

    await userEvent.click(chevron('Scroll forward'));

    expect(scrollBy).toHaveBeenCalledWith({ left: TRACK_WIDTH * 0.8 });
  });

  it.each([
    { key: '{End}', left: CONTENT_WIDTH - TRACK_WIDTH },
    { key: '{Home}', left: 0 },
  ])('jumps the track to its edge on $key', async ({ key, left }) => {
    overflowing();
    renderShelf();
    const scrollTo = vi.fn();
    track().scrollTo = scrollTo;

    track().focus();
    await userEvent.keyboard(key);

    expect(scrollTo).toHaveBeenCalledWith({ left });
  });

  it('asks for more once the viewer is within a screen of the end', () => {
    overflowing();
    const onEndReached = vi.fn();
    renderShelf({ onEndReached });

    expect(onEndReached).not.toHaveBeenCalled();
    track().scrollLeft = 500;
    fireEvent.scroll(track());

    expect(onEndReached).toHaveBeenCalledOnce();
  });

  it('throws a named error for a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Shelf.Item />)).toThrow('Shelf.Item must be inside Shelf.Root');
  });

  it.each(variantNames(shelfStyles.variants.variant))(
    'holds the place of a %s shelf with five items and no text',
    (variant) => {
      const { container } = render(<ShelfSkeleton variant={variant} />);

      expect(
        container.querySelector('[data-slot=shelf-skeleton]')?.lastElementChild?.children
      ).toHaveLength(5);
      expect(container).toHaveTextContent('');
    }
  );

  it('passes axe, loaded and as a skeleton', async () => {
    renderShelf();
    render(<ShelfSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
