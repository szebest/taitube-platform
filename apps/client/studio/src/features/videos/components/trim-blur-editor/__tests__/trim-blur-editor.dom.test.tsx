import { screen, within } from '@testing-library/react';
import { renderEditVideo } from '#app/features/videos/__tests__/render-edit-video';
import { generationsOf } from '#app/features/videos/__tests__/video-pipeline-api.fixture';

const applied = generationsOf({
  activeGeneration: 2,
  edit: {
    baseGeneration: 1,
    generation: 2,
    status: 'applied',
    trim: { startMs: 10_000, endMs: 90_000 },
    blurs: [],
    updatedAt: '2026-03-01T12:00:00.000Z',
  },
  revertible: true,
});

describe('apps/client/studio: TrimBlurEditor', () => {
  it('says before the first save that the base is kept 14 days, then baked in', async () => {
    await renderEditVideo();

    expect(await screen.findByText(/kept for 14 days after your last edit/)).toBeInTheDocument();
  });

  it('saves a blurred region over the whole video as an edit with no trim', async () => {
    const { state, user } = await renderEditVideo();

    await user.click(await screen.findByRole('button', { name: 'Add a blurred region' }));
    await user.click(screen.getByRole('button', { name: 'Save and render' }));

    expect(
      await screen.findByText('Edits saved. The edited version is being prepared.')
    ).toBeInTheDocument();
    expect(state.saved).toEqual([
      {
        trim: null,
        blurs: [
          { startMs: 0, endMs: 5_000, shape: 'rect', x: 0.4, y: 0.4, w: 0.2, h: 0.2, strength: 10 },
        ],
      },
    ]);
  });

  it('refuses a region that leaves the frame before anything is sent', async () => {
    const { state, user } = await renderEditVideo();

    await user.click(await screen.findByRole('button', { name: 'Add a blurred region' }));
    const width = screen.getByLabelText('Width, %');
    await user.clear(width);
    await user.type(width, '90');
    await user.click(screen.getByRole('button', { name: 'Save and render' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the edits');
    expect(state.saved).toEqual([]);
  });

  it('opens on the saved list and reverts the edit playing under the version of the video', async () => {
    const { state, user } = await renderEditVideo({ generations: applied });

    expect(await screen.findByText('Keeps 0:10 to 1:30')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revert to the original' }));

    expect(await screen.findByText('The original version is back.')).toBeInTheDocument();
    expect(state.reverted).toEqual([{ version: 4 }]);
  });

  it('lists each region and removes the one asked for', async () => {
    const { user } = await renderEditVideo();

    await user.click(await screen.findByRole('button', { name: 'Add a blurred region' }));
    const list = screen.getByRole('list', { name: 'Blurred regions of this video' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await user.click(within(list).getByRole('button', { name: 'Remove the region from 0:00' }));

    expect(screen.getByText('No blurred regions.')).toBeInTheDocument();
  });
});
