import { screen, within } from '@testing-library/react';
import { TOKEN_GROUPS } from '@vp/design-tokens';
import { appearance } from '@vp/ui/appearance/registry';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAdvanced = () => renderRoute(getRouter, '/settings/appearance/advanced');

describe('apps/client/web: a token group row', () => {
  it.each(TOKEN_GROUPS.map((group) => ({ group })))(
    'offers the theme default and each set of $group the registry offers, the default chosen',
    async ({ group }) => {
      await renderAdvanced();

      const rows = await screen.findAllByRole('group');
      const radios = within(rows.find(({ id }) => id === group) as HTMLElement).getAllByRole(
        'radio'
      );

      expect(radios).toHaveLength(appearance.offer[group].length + 1);
      expect(radios[0]).toHaveAccessibleName(/^Theme default \(/);
      expect(radios[0]).toBeChecked();
    }
  );

  it('chooses an offered set and puts the theme default back, one group at a time', async () => {
    const { user } = await renderAdvanced();
    const corners = within(await screen.findByRole('group', { name: 'Corners' }));

    await user.click(corners.getByRole('radio', { name: 'Sharp' }));
    expect(corners.getByRole('radio', { name: 'Sharp' })).toBeChecked();

    await user.click(corners.getByRole('radio', { name: /^Theme default/ }));
    expect(corners.getByRole('radio', { name: /^Theme default/ })).toBeChecked();
    expect(corners.queryByText('Changed')).toBeNull();
  });
});
