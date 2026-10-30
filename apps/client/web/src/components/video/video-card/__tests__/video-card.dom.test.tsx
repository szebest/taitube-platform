import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentPropsWithRef } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { VideoCard, VideoCardSkeleton, videoCardStyles } from '..';
import type { VideoCardRootProps } from '../video-card';
import type { VideoCardActionsProps } from '../video-card-actions';

const ChannelLink = (props: ComponentPropsWithRef<'a'>) => <a {...props} />;

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000001';

const renderCard = (
  props: VideoCardRootProps = {},
  actions: VideoCardActionsProps = { onSave: vi.fn(), onQueue: vi.fn() }
) =>
  render(
    <AppProviders>
      <VideoCard.Root videoId={VIDEO_ID} {...props}>
        <VideoCard.Thumb
          src="/poster.jpg"
          duration="18:42"
          spokenDuration="18 minutes 42 seconds"
          progress={0.5}
        />
        <VideoCard.Byline name="Marta Reis Films" asChild>
          <ChannelLink href="/channel/marta" />
        </VideoCard.Byline>
        <VideoCard.Title asChild>
          <a href={`/watch/${VIDEO_ID}`}>Lisbon at night</a>
        </VideoCard.Title>
        <VideoCard.Meta>412K views · 2 days ago</VideoCard.Meta>
        <VideoCard.Snippet>A night walk from Alfama.</VideoCard.Snippet>
        <VideoCard.Reason>Viewers also watched</VideoCard.Reason>
        <VideoCard.Menu {...actions} />
        <VideoCard.Expanded {...actions}>A night walk from Alfama to the river.</VideoCard.Expanded>
      </VideoCard.Root>
    </AppProviders>
  );

const card = () => screen.getByRole('article');

describe('apps/client/web: VideoCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(variantNames(videoCardStyles.variants.variant))(
    'links the %s card to its video and its channel',
    (variant) => {
      renderCard({ variant });

      expect(card()).toHaveAttribute('data-variant', variant);
      expect(screen.getByRole('link', { name: 'Lisbon at night' })).toHaveAttribute(
        'href',
        `/watch/${VIDEO_ID}`
      );
      expect(screen.getByRole('link', { name: 'Marta Reis Films' })).toHaveAttribute(
        'href',
        '/channel/marta'
      );
    }
  );

  it('prints a snippet of the description under the meta', () => {
    renderCard({ variant: 'row' });

    expect(screen.getByText('A night walk from Alfama.')).toHaveAttribute(
      'data-slot',
      'video-card-snippet'
    );
  });

  it('shows how much was watched and says the duration in words', () => {
    renderCard();

    expect(screen.getByRole('progressbar', { name: 'Watched' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(screen.getByText('18 minutes 42 seconds')).toBeInTheDocument();
  });

  it.each([
    {
      scenario: 'a mouse resting 500 ms on a shelf card',
      variant: 'shelf' as const,
      pointerType: 'mouse',
      after: 500,
      expanded: true,
    },
    {
      scenario: 'a mouse passing by',
      variant: 'shelf' as const,
      pointerType: 'mouse',
      after: 499,
      expanded: false,
    },
    {
      scenario: 'a touch',
      variant: 'grid' as const,
      pointerType: 'touch',
      after: 500,
      expanded: false,
    },
    {
      scenario: 'a mouse on a row',
      variant: 'row' as const,
      pointerType: 'mouse',
      after: 500,
      expanded: false,
    },
  ])('expands on $scenario: $expanded', ({ variant, pointerType, after, expanded }) => {
    vi.useFakeTimers();
    renderCard({ variant });

    fireEvent.pointerOver(card(), { pointerType });
    act(() => vi.advanceTimersByTime(after));

    expect(card().hasAttribute('data-expanded')).toBe(expanded);
    expect(screen.queryByText('A night walk from Alfama to the river.') !== null).toBe(expanded);
  });

  it.each([
    { scenario: 'the pointer leaves', cancel: () => fireEvent.pointerOut(card()) },
    { scenario: 'the page scrolls', cancel: () => fireEvent.scroll(window) },
  ])('collapses when $scenario', ({ cancel }) => {
    vi.useFakeTimers();
    renderCard();

    fireEvent.pointerOver(card(), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(500));
    act(cancel);

    expect(card()).not.toHaveAttribute('data-expanded');
  });

  it('saves and queues from the menu', async () => {
    const actions = { onSave: vi.fn(), onQueue: vi.fn() };
    renderCard({}, actions);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save' }));

    expect(actions.onSave).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Queue' })).toBeInTheDocument();
  });

  it('draws no menu when the card has no actions', () => {
    renderCard({}, {});

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('marks an unavailable video and drops its image', () => {
    renderCard({ state: 'unavailable' });

    expect(screen.getByRole('link', { name: 'Lisbon at night' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(card().querySelector('img[src="/poster.jpg"]')).toBeNull();
  });

  it('says a live video is live', () => {
    renderCard({ state: 'live' });

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('names the frame for the morph into the stage', () => {
    renderCard();

    expect(card().querySelector('[data-slot=video-card-thumb]')).toHaveStyle({
      viewTransitionName: `video-${VIDEO_ID}`,
    });
  });

  it('throws a named error for a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<VideoCard.Meta>412K views</VideoCard.Meta>)).toThrow(
      'VideoCard.Meta must be inside VideoCard.Root'
    );
  });

  it.each(variantNames(videoCardStyles.variants.variant))(
    'holds the place of three %s cards with no text',
    (variant) => {
      const { container } = render(<VideoCardSkeleton variant={variant} count={3} />);

      expect(container.querySelectorAll('[data-slot=video-card-skeleton]')).toHaveLength(3);
      expect(container).toHaveTextContent('');
    }
  );

  it('passes axe, at rest, expanded and as a skeleton', async () => {
    vi.useFakeTimers();
    renderCard();
    render(<VideoCardSkeleton variant="shelf" />);
    fireEvent.pointerOver(card(), { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(500));
    vi.useRealTimers();

    expect(await axeViolations()).toEqual([]);
  });
});
