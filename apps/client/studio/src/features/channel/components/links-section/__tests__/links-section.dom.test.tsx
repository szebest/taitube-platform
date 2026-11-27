import { screen, within } from '@testing-library/react';
import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Links' });
const save = () => within(section()).getByRole('button', { name: 'Save' });
const SITE = { label: 'Site', url: 'https://example.com', platform: 'website' as const };

describe('apps/client/studio: links section', () => {
  it('lists the links the channel has and adds rows up to eight', async () => {
    const { user } = await renderCustomization({ links: [SITE] });

    expect(within(section()).getByLabelText('Link title 1')).toHaveValue('Site');
    expect(within(section()).getByLabelText('Link address 1')).toHaveValue('https://example.com');

    for (let added = 1; added < 8; added++) {
      await user.click(within(section()).getByRole('button', { name: 'Add a link' }));
    }

    expect(within(section()).getByLabelText('Link title 8')).toHaveValue('');
    expect(within(section()).getByRole('button', { name: 'Add a link' })).toBeDisabled();
  });

  it.each([
    { url: 'https://github.com/creator', platform: 'github' },
    { url: 'https://example.com', platform: 'website' },
  ])('recognises $url as $platform as it is typed', async ({ url, platform }) => {
    const { user } = await renderCustomization({ links: [{ ...SITE, url: '' }] });

    await user.type(within(section()).getByLabelText('Link address 1'), url);

    expect(
      within(section()).getByRole('img', { name: `Recognised as ${platform}` })
    ).toBeInTheDocument();
  });

  it('saves the links in the order they were moved to, with the banner button', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization(
      {
        links: [
          SITE,
          { label: 'Code', url: 'https://github.com/creator', platform: 'github' as const },
        ],
      },
      [savesChannel({}, bodies)]
    );

    await user.click(within(section()).getByRole('button', { name: 'Move link 2 up' }));
    await user.type(within(section()).getByLabelText('Button label'), 'Shop');
    await user.type(within(section()).getByLabelText('Button address'), 'https://shop.example');
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        links: [
          { label: 'Code', url: 'https://github.com/creator' },
          { label: 'Site', url: 'https://example.com' },
        ],
        bannerLink: { label: 'Shop', url: 'https://shop.example' },
      },
    ]);
  });

  it.each([
    { scenario: 'a link that is not https', field: 'Link address 1', value: 'http://example.com' },
    {
      scenario: 'a banner button that is not https',
      field: 'Button address',
      value: 'http://x.example',
    },
  ])('refuses $scenario', async ({ field, value }) => {
    const { user } = await renderCustomization({ links: [SITE] });

    await user.type(within(section()).getByLabelText('Button label'), 'Shop');
    await user.clear(within(section()).getByLabelText(field));
    await user.type(within(section()).getByLabelText(field), value);
    await user.tab();

    expect(save()).toBeDisabled();
  });

  it('removes a link and saves an empty list as none, with no banner button', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({ links: [SITE] }, [savesChannel({}, bodies)]);

    await user.click(within(section()).getByRole('button', { name: 'Remove link 1' }));
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ links: [], bannerLink: null }]);
  });
});
