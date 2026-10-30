import { screen, within } from '@testing-library/react';

import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'About' });
const save = () => within(section()).getByRole('button', { name: 'Save' });

describe('apps/client/studio: about section', () => {
  it('lists the links the channel has, and adds a row up to five', async () => {
    const { user } = await renderCustomization({
      links: [{ label: 'Site', url: 'https://example.com' }],
    });

    expect(within(section()).getByLabelText('Link title 1')).toHaveValue('Site');
    expect(within(section()).getByLabelText('Link address 1')).toHaveValue('https://example.com');

    for (let added = 1; added < 5; added++) {
      await user.click(within(section()).getByRole('button', { name: 'Add a link' }));
    }

    expect(within(section()).getByLabelText('Link title 5')).toHaveValue('');
    expect(within(section()).getByRole('button', { name: 'Add a link' })).toBeDisabled();
  });

  it('saves the description and the links, leaving blank rows out and an empty description as none', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({ bio: 'Before' }, [savesChannel({}, bodies)]);

    await user.clear(within(section()).getByLabelText('Description'));
    await user.click(within(section()).getByRole('button', { name: 'Add a link' }));
    await user.click(within(section()).getByRole('button', { name: 'Add a link' }));
    await user.type(within(section()).getByLabelText('Link title 1'), 'Site');
    await user.type(within(section()).getByLabelText('Link address 1'), 'https://example.com');
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ bio: null, links: [{ label: 'Site', url: 'https://example.com' }] }]);
  });

  it('removes a link and refuses an address that is not https', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization(
      { links: [{ label: 'Site', url: 'https://example.com' }] },
      [savesChannel({}, bodies)]
    );

    await user.clear(within(section()).getByLabelText('Link address 1'));
    await user.type(within(section()).getByLabelText('Link address 1'), 'http://example.com');
    await user.tab();

    expect(await within(section()).findByText(/At most 5 links/)).toBeInTheDocument();
    expect(save()).toBeDisabled();

    await user.click(within(section()).getByRole('button', { name: 'Remove link 1' }));

    expect(within(section()).queryByLabelText('Link title 1')).toBeNull();
    await user.click(save());
    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ bio: null, links: [] }]);
  });

  it('refuses a description over 1000 characters', async () => {
    const { user } = await renderCustomization();

    await user.click(within(section()).getByLabelText('Description'));
    await user.paste('x'.repeat(1001));

    expect(await within(section()).findByText('Use up to 1000 characters.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});
