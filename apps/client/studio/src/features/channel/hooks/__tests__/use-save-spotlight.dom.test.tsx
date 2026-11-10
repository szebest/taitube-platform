import { screen, within } from '@testing-library/react';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

describe('apps/client/studio: useSaveSpotlight', () => {
  it('saves the spotlight and says so on its section', async () => {
    const { user } = await renderCustomization();
    const section = await screen.findByRole('form', { name: 'Trailer and welcome back' });

    await user.click(within(section).getByRole('tab', { name: /Polish|polski/i }));
    await user.type(within(section).getByLabelText(/Description in/), 'Opis');
    await user.click(within(section).getByRole('button', { name: 'Save' }));

    expect(await within(section).findByText('Saved')).toBeInTheDocument();
  });
});
