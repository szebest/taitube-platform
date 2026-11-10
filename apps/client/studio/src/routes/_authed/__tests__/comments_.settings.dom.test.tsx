import { screen, within } from '@testing-library/react';
import { renderSettings } from '#app/features/comments/__tests__/render-settings';

describe('apps/client/studio: /comments/settings', () => {
  it('opens the settings of the acting channel with the stored values, under the comments entry of the navigation', async () => {
    await renderSettings();

    expect(screen.getByRole('radio', { name: 'Nothing' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remove spoiler' })).toBeInTheDocument();
    const navigation = screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
    expect(within(navigation).getByRole('link', { name: 'Comments' })).toBeInTheDocument();
  });
});
