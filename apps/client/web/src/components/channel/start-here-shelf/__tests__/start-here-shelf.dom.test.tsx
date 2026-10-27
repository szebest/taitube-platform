import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { VideoCard } from '#app/components/video/video-card';
import { StartHereShelf, StartHereShelfSkeleton, type StartHereSource } from '..';

const VIDEOS = [
  { id: '0190a1b2-0000-7000-8000-000000000011', title: 'Lisbon at night', position: '1' },
  { id: '0190a1b2-0000-7000-8000-000000000012', title: 'The 28 tram', position: '2' },
];

const renderShelf = (source: StartHereSource) =>
  render(
    <AppProviders>
      <StartHereShelf.Root source={source}>
        <StartHereShelf.Header>
          <StartHereShelf.Kicker />
          <StartHereShelf.Note>New here? Begin with these.</StartHereShelf.Note>
        </StartHereShelf.Header>
        <StartHereShelf.Track>
          {VIDEOS.map((video) => (
            <StartHereShelf.Item key={video.id} position={video.position}>
              <VideoCard.Root variant="shelf" videoId={video.id}>
                <VideoCard.Title asChild>
                  <a href={`/watch/${video.id}`}>{video.title}</a>
                </VideoCard.Title>
              </VideoCard.Root>
            </StartHereShelf.Item>
          ))}
        </StartHereShelf.Track>
        <StartHereShelf.Footer>
          <StartHereShelf.Attribution />
        </StartHereShelf.Footer>
      </StartHereShelf.Root>
    </AppProviders>
  );

describe('apps/client/web: StartHereShelf', () => {
  it.each([
    {
      source: 'pinned',
      heading: 'Start here',
      attribution: 'Pinned by creator',
      note: true,
      positions: ['1', '2'],
    },
    {
      source: 'popular',
      heading: 'Popular on this channel',
      attribution: 'Most viewed',
      note: false,
      positions: [],
    },
  ] as const)(
    'words and numbers the $source shelf by its source',
    ({ source, heading, attribution, note, positions }) => {
      renderShelf(source);

      const shelf = screen.getByRole('region', { name: heading });

      expect(within(shelf).getByText(attribution)).toBeInTheDocument();
      expect(within(shelf).queryByText('New here? Begin with these.') !== null).toBe(note);
      expect(
        [...shelf.querySelectorAll('[data-slot="start-here-shelf-position"]')].map(
          (number) => number.textContent
        )
      ).toEqual(positions);
    }
  );

  it('passes axe, loaded and as a skeleton', async () => {
    renderShelf('pinned');
    render(<StartHereShelfSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
