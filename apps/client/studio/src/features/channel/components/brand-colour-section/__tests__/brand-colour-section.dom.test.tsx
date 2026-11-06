import { screen, within } from '@testing-library/react';
import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Brand colour' });
const field = () => within(section()).getByLabelText('Colour');
const save = () => within(section()).getByRole('button', { name: 'Save' });

describe('apps/client/studio: brand colour section', () => {
  it('shows the colour the channel has with its derived accent on a dark and a light page', async () => {
    await renderCustomization({ brandColor: '#3366cc' });

    expect(field()).toHaveValue('#3366cc');
    expect(within(section()).getByText('On dark')).toBeInTheDocument();
    expect(within(section()).getByText('On light')).toBeInTheDocument();
  });

  it('previews a colour as it is typed and saves it, a hostile one included', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({}, [savesChannel({}, bodies)]);

    await user.type(field(), '#ffff00');
    expect(within(section()).getByText('On dark')).toBeInTheDocument();
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ brandColor: '#ffff00' }]);
  });

  it('sends null for an emptied field, which clears the colour', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({ brandColor: '#3366cc' }, [
      savesChannel({}, bodies),
    ]);

    await user.clear(field());
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ brandColor: null }]);
  });

  it('refuses a malformed colour, shows no preview for it and saves nothing', async () => {
    const { user } = await renderCustomization();

    await user.type(field(), 'blue');

    expect(await within(section()).findByText('Use a colour like #3366cc.')).toBeInTheDocument();
    expect(within(section()).queryByText('On dark')).toBeNull();
    expect(save()).toBeDisabled();
  });
});
