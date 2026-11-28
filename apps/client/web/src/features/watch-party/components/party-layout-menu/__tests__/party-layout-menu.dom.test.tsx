import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { PartyPreferences } from '@vp/domain/settings';
import { AppProviders } from '#app/__tests__/providers';
import { PartyLayoutMenu } from '../party-layout-menu';

function renderMenu(preferences: Partial<PartyPreferences> = {}) {
  const onChange = vi.fn();
  render(
    <AppProviders>
      <PartyLayoutMenu
        preferences={{ layout: 'side', reactionOverlay: true, systemLines: true, ...preferences }}
        onChange={onChange}
      />
    </AppProviders>
  );

  return { onChange };
}

describe('apps/client/web: PartyLayoutMenu', () => {
  it('offers the four layouts and marks the current one', async () => {
    renderMenu({ layout: 'theater' });

    await userEvent.click(screen.getByRole('button', { name: 'Layout' }));

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Chat beside',
      'Chat below',
      'Theater',
      'Focus',
    ]);
    expect(screen.getByRole('menuitemradio', { name: 'Theater' })).toBeChecked();
  });

  it.each([
    { pick: 'menuitemradio', name: 'Focus', patch: { layout: 'focus' } },
    { pick: 'menuitemcheckbox', name: 'Show reactions', patch: { reactionOverlay: false } },
    { pick: 'menuitemcheckbox', name: 'Show system lines in chat', patch: { systemLines: false } },
  ] as const)('reports $name as $patch', async ({ pick, name, patch }) => {
    const { onChange } = renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Layout' }));
    await userEvent.click(screen.getByRole(pick, { name }));

    expect(onChange).toHaveBeenCalledWith(patch);
  });
});
