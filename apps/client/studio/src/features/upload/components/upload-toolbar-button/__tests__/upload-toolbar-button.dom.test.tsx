import { screen, within } from '@testing-library/react';
import { renderStudio } from '#app/features/upload/__tests__/upload-api.fixture';

describe('apps/client/studio: UploadToolbarButton', () => {
  it('opens the upload dialog from the toolbar on any page', async () => {
    const { user } = await renderStudio();

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Upload' }));

    expect(await screen.findByRole('dialog', { name: 'Upload a video' })).toBeInTheDocument();
  });
});
