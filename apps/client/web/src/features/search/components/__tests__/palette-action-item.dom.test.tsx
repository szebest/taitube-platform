import { screen, within } from '@testing-library/react';

import { openPalette } from '#app/features/search/__tests__/search-fixtures';

const actions = () => within(screen.getByRole('group', { name: 'Actions' }));

describe('apps/client/web: PaletteActionItem', () => {
  it('lists the actions under their own heading, each named by its kind', async () => {
    await openPalette();

    expect(actions().getByRole('option', { name: /Switch to dark mode/ })).toHaveTextContent(
      'mode'
    );
    expect(actions().getByRole('option', { name: /Switch to Nocturne/ })).toHaveTextContent(
      'theme'
    );
  });

  it('applies a mode and closes the palette', async () => {
    const { user } = await openPalette();

    await user.click(actions().getByRole('option', { name: /Switch to dark mode/ }));

    expect(decodeURIComponent(document.cookie)).toContain('"mode":"dark"');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a theme and closes the palette', async () => {
    const { user } = await openPalette();

    await user.click(actions().getByRole('option', { name: /Switch to Nocturne/ }));

    expect(decodeURIComponent(document.cookie)).toContain('"theme":"nocturne"');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no studio action to a guest', async () => {
    await openPalette();

    expect(actions().queryByRole('option', { name: 'Upload a video' })).not.toBeInTheDocument();
  });
});
