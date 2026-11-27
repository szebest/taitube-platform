import { screen, waitFor, within } from '@testing-library/react';
import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Picture and banner' });

describe('apps/client/studio: images section', () => {
  it('previews the picture and the banner the channel has, with their guides', async () => {
    await renderCustomization({
      avatarUrl: 'https://cdn.test/a.png',
      bannerUrl: 'https://cdn.test/b.png',
    });

    expect(within(section()).getByRole('img', { name: 'Picture preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/a.png'
    );
    expect(within(section()).getByRole('img', { name: 'Banner preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/b.png'
    );
    expect(within(section()).getAllByText(/keep .* inside the guide/)).toHaveLength(2);
  });

  it('offers a file for the picture and for the banner, and no save of its own', async () => {
    await renderCustomization();

    expect(
      within(section()).getByText('Drop a picture here, or click to choose one')
    ).toBeVisible();
    expect(within(section()).getByText('Drop a banner here, or click to choose one')).toBeVisible();
    expect(within(section()).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it.each([
    { name: 'the picture', button: 'Remove picture', body: { avatarUrl: null } },
    { name: 'the banner', button: 'Remove banner', body: { bannerUrl: null } },
  ])('takes away $name with no address at once', async ({ button, body }) => {
    const saved: unknown[] = [];
    const { user } = await renderCustomization(
      { avatarUrl: 'https://cdn.test/a.png', bannerUrl: 'https://cdn.test/b.png' },
      [savesChannel({}, saved)]
    );

    await user.click(within(section()).getByRole('button', { name: button }));

    await waitFor(() =>
      expect(within(section()).queryByRole('button', { name: button })).toBeNull()
    );
    expect(saved).toEqual([body]);
  });
});
