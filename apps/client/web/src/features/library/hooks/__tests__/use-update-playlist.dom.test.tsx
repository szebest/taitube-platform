import { screen } from '@testing-library/react';
import { updatePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';

import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: useUpdatePlaylist', () => {
  it('puts the old title back and says so when the edit is refused', async () => {
    const { user } = await renderPlaylist({}, [
      mockEndpoint(updatePlaylist, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Night trips');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Road trips' })
    ).toBeInTheDocument();
  });
});
