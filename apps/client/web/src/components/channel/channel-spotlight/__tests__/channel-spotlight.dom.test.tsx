import { render, screen, within } from '@testing-library/react';
import { VideoCard } from '@vp/components';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { ChannelSpotlight, ChannelSpotlightSkeleton } from '..';
import type { ChannelSpotlightRootProps } from '../channel-spotlight';

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000031';

const renderSpotlight = ({ source }: Pick<ChannelSpotlightRootProps, 'source'>) =>
  render(
    <AppProviders>
      <ChannelSpotlight.Root source={source}>
        <VideoCard.Root variant="spotlight" videoId={VIDEO_ID}>
          <VideoCard.Thumb alt="" duration="2:04" />
          <ChannelSpotlight.Kicker>Channel trailer</ChannelSpotlight.Kicker>
          <VideoCard.Title asChild>
            <a href={`/watch/${VIDEO_ID}`}>Two minutes</a>
          </VideoCard.Title>
          <ChannelSpotlight.Actions>
            <button type="button">Watch</button>
          </ChannelSpotlight.Actions>
        </VideoCard.Root>
      </ChannelSpotlight.Root>
    </AppProviders>
  );

describe('apps/client/web: ChannelSpotlight', () => {
  it('is a section named by its kicker, holding the card and its actions', () => {
    renderSpotlight({ source: 'trailer' });

    const spotlight = screen.getByRole('region', { name: 'Channel trailer' });

    expect(within(spotlight).getByRole('link', { name: 'Two minutes' })).toBeInTheDocument();
    expect(within(spotlight).getByRole('button', { name: 'Watch' })).toBeInTheDocument();
  });

  it.each(['trailer', 'returning'] as const)('marks the %s source on the section', (source) => {
    renderSpotlight({ source });

    expect(screen.getByRole('region')).toHaveAttribute('data-source', source);
  });

  it('names a part used outside the root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ChannelSpotlight.Actions />)).toThrow(
      'ChannelSpotlight.Actions must be inside ChannelSpotlight.Root'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderSpotlight({ source: 'returning' });
    render(<ChannelSpotlightSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
