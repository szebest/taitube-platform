import { screen } from '@testing-library/react';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

describe('apps/client/studio: useActingChannel', () => {
  it('shows the acting channel that the API answers, not the session channel', async () => {
    await renderCustomization({ displayName: 'Acting Channel' });

    expect(await screen.findByDisplayValue('Acting Channel')).toBeInTheDocument();
  });
});
