import { screen, within } from '@testing-library/react';

import { renderCustomization, savesChannel } from '../../__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Picture and banner' });
const save = () => within(section()).getByRole('button', { name: 'Save' });

describe('apps/client/studio: branding section', () => {
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
    expect(within(section()).getByLabelText('Banner address')).toHaveAccessibleDescription(
      'Phones show only the centre band: keep text inside the guide.'
    );
  });

  it('saves an address, previews it as it is typed, and sends none for an emptied one', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({ bannerUrl: 'https://cdn.test/b.png' }, [
      savesChannel({}, bodies),
    ]);

    await user.type(
      within(section()).getByLabelText('Picture address'),
      ' https://cdn.test/new.png'
    );
    expect(within(section()).getByRole('img', { name: 'Picture preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/new.png'
    );
    await user.clear(within(section()).getByLabelText('Banner address'));
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ avatarUrl: 'https://cdn.test/new.png', bannerUrl: null }]);
  });

  it('refuses an address that is not https and shows no preview for it', async () => {
    const { user } = await renderCustomization();

    await user.type(within(section()).getByLabelText('Picture address'), 'http://cdn.test/a.png');

    expect(await within(section()).findByText(/Use an https address/)).toBeInTheDocument();
    expect(within(section()).queryByRole('img')).toBeNull();
    expect(save()).toBeDisabled();
  });
});
