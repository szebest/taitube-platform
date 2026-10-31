import { screen } from '@testing-library/react';
import { libraryVideo } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '#app/features/library/__tests__/render-library';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

const LIKED = [libraryVideo(1, 'Tram ride'), libraryVideo(2, 'Lisbon'), libraryVideo(3, 'Metro')];

const URL = '/feed/history?tab=liked';

describe('apps/client/web: LikedList', () => {
  useLibraryClock();

  it('lists the liked videos as row cards', async () => {
    await renderLibrary(URL, { liked: LIKED });

    expect(await screen.findByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(LIKED.length);
  });

  it('shows one line when nothing was liked', async () => {
    await renderLibrary(URL);

    expect(await screen.findByText('No liked videos yet')).toBeInTheDocument();
  });

  describe('paging by keyset', () => {
    beforeEach(() => RecordingObserver.install());
    afterEach(() => vi.unstubAllGlobals());

    it('asks for the next page with the cursor once the end is near', async () => {
      await renderLibrary(URL, { liked: LIKED, pageSize: 2 });
      await screen.findByRole('link', { name: 'Tram ride' });
      expect(screen.queryByRole('link', { name: 'Metro' })).toBeNull();

      RecordingObserver.enterView();

      expect(await screen.findByRole('link', { name: 'Metro' })).toBeInTheDocument();
    });
  });
});
