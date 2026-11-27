import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { PartyLayoutMenu } from '../party-layout-menu';

function renderMenu(layout: 'side' | 'below' | 'theater' | 'focus' = 'side') {
  const onLayoutChange = vi.fn();
  render(
    <AppProviders>
      <PartyLayoutMenu layout={layout} onLayoutChange={onLayoutChange} />
    </AppProviders>
  );

  return { onLayoutChange };
}

describe('apps/client/web: PartyLayoutMenu', () => {
  it('offers the four layouts and marks the current one', async () => {
    renderMenu('theater');

    await userEvent.click(screen.getByRole('button', { name: 'Layout' }));

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Chat beside',
      'Chat below',
      'Theater',
      'Focus',
    ]);
    expect(screen.getByRole('menuitemradio', { name: 'Theater' })).toBeChecked();
  });

  it('reports the layout the viewer picked', async () => {
    const { onLayoutChange } = renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Layout' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Focus' }));

    expect(onLayoutChange).toHaveBeenCalledWith('focus');
  });
});
