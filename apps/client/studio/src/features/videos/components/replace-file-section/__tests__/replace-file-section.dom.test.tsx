import { screen } from '@testing-library/react';
import axios from 'axios';
import { renderEditVideo } from '#app/features/videos/__tests__/render-edit-video';
import { UPLOAD_URL } from '#app/features/videos/__tests__/video-pipeline-api.fixture';

describe('apps/client/studio: ReplaceFileSection', () => {
  it('uploads the chosen file into the new generation, then starts its render', async () => {
    const put = vi.spyOn(axios, 'put').mockResolvedValue({});
    const { state, user } = await renderEditVideo();
    const file = new File(['new bytes'], 'retake.mp4', { type: 'video/mp4' });

    await user.upload(await screen.findByLabelText('New file'), file);
    await user.click(screen.getByRole('button', { name: 'Replace' }));

    expect(
      await screen.findByText('Upload finished. The new file is being processed.')
    ).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith(UPLOAD_URL, file, expect.objectContaining({ headers: {} }));
    expect(state.completed).toEqual([{ generation: 2 }]);
  });

  it('offers nothing to replace until a file is chosen', async () => {
    await renderEditVideo();

    expect(await screen.findByRole('button', { name: 'Replace' })).toBeDisabled();
  });
});
