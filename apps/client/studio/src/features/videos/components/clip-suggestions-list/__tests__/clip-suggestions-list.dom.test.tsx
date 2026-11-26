import { screen, within } from '@testing-library/react';
import { renderEditVideo } from '#app/features/videos/__tests__/render-edit-video';
import { suggestion } from '#app/features/videos/__tests__/video-pipeline-api.fixture';

describe('apps/client/studio: ClipSuggestionsList', () => {
  it('says there are none before anyone has watched', async () => {
    await renderEditVideo();

    expect(
      await screen.findByText('No suggestions yet. They appear once people have watched the video.')
    ).toBeInTheDocument();
  });

  it('lists each window with its chapter and share lost, and clips one as a normal clip', async () => {
    const { state, user } = await renderEditVideo({
      suggestions: [suggestion(30_000, 'The good part'), suggestion(90_000)],
    });

    const list = await screen.findByRole('list', { name: 'Clip suggestions for this video' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('0:30 to 1:00 · The good part');
    expect(first).toHaveTextContent('4% of viewers left during it');
    await user.click(
      within(second as HTMLElement).getByRole('button', { name: 'Create a clip from 1:30' })
    );

    expect(state.clips).toEqual([{ startMs: 90_000, endMs: 120_000, title: 'Clip from 1:30' }]);
  });
});
