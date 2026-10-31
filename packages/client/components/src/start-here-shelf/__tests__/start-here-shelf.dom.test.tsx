import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { renderWithCopy } from '../../__tests__/render-with-copy';
import { StartHereShelf, StartHereShelfSkeleton, type StartHereSource } from '..';
import { VideoCard } from '../../video-card';

const VIDEOS = [
  { id: '0190a1b2-0000-7000-8000-000000000011', title: 'Lisbon at night', position: '1' },
  { id: '0190a1b2-0000-7000-8000-000000000012', title: 'The 28 tram', position: '2' },
];

const renderShelf = (source: StartHereSource) =>
  renderWithCopy(
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
  );

describe('@vp/components: StartHereShelf', () => {
  it.each([
    {
      source: 'pinned',
      heading: 'startHere',
      attribution: 'pinnedByCreator',
      note: true,
      positions: ['1', '2'],
    },
    {
      source: 'popular',
      heading: 'mostWatched',
      attribution: 'mostViewed',
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
