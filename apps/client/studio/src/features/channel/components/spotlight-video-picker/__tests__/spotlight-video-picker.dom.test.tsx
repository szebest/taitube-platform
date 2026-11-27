import { screen, within } from '@testing-library/react';
import { featuredApi, libraryOf } from '#app/__tests__/featured-api.fixture';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const LIBRARY = libraryOf(2);
const section = () => screen.getByRole('form', { name: 'Trailer and welcome back' });

describe('apps/client/studio: spotlight video picker', () => {
  it('picks one of the public ready videos, shows its title and clears it again', async () => {
    const { user } = await renderCustomization({}, featuredApi({ library: LIBRARY }).handlers);

    await user.click(
      within(section()).getAllByRole('button', { name: 'Choose a video' })[0] as HTMLElement
    );
    await user.click(await screen.findByRole('option', { name: 'Video 1' }));

    expect(within(section()).getByText('Video 1')).toBeInTheDocument();
    await user.click(within(section()).getByRole('button', { name: 'Remove' }));
    expect(within(section()).queryByText('Video 1')).toBeNull();
  });
});
