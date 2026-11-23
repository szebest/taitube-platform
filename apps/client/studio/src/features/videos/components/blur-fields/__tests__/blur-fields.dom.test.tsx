import { screen } from '@testing-library/react';
import { renderEditVideo } from '#app/features/videos/__tests__/render-edit-video';

describe('apps/client/studio: BlurFields', () => {
  it('reads the region as percentages of the frame and writes shares back', async () => {
    const { state, user } = await renderEditVideo();

    await user.click(await screen.findByRole('button', { name: 'Add a blurred region' }));
    const left = screen.getByLabelText('Left edge, % of the width');
    expect(left).toHaveValue(40);
    await user.clear(left);
    await user.type(left, '10');
    await user.click(screen.getByRole('button', { name: 'Save and render' }));

    expect(await screen.findByText(/Edits saved/)).toBeInTheDocument();
    expect(state.saved).toEqual([
      expect.objectContaining({ blurs: [expect.objectContaining({ x: 0.1 })] }),
    ]);
  });

  it('sets the strength on its slider', async () => {
    const { user } = await renderEditVideo();

    await user.click(await screen.findByRole('button', { name: 'Add a blurred region' }));
    const strength = screen.getByRole('slider', { name: 'Strength' });
    strength.focus();
    await user.keyboard('{ArrowRight}');

    expect(strength).toHaveAttribute('aria-valuenow', '11');
  });
});
