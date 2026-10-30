import { render } from '@testing-library/react';
import { TOKEN_GROUPS, tokenGroups } from '@vp/design-tokens';

import { AppProviders } from '#app/__tests__/providers';
import { SETTING_ROWS } from '#app/features/settings/settings-index';
import { SetPreview, TOKEN_GROUP_PREVIEWS } from '../token-group-map';

describe('apps/client/web: the token group map', () => {
  it('holds a preview for every group of the registry, each a row of the advanced page', () => {
    expect(Object.keys(TOKEN_GROUP_PREVIEWS).sort()).toEqual([...TOKEN_GROUPS].sort());
    expect(
      SETTING_ROWS.filter(({ section }) => section === 'advanced')
        .map(({ id }) => id)
        .sort()
    ).toEqual([...TOKEN_GROUPS].sort());
  });

  it.each(TOKEN_GROUPS.map((group) => ({ group })))(
    'scopes the $group preview by its set attribute',
    ({ group }) => {
      const { container } = render(<SetPreview group={group} setId="airy" />, {
        wrapper: AppProviders,
      });

      expect(container.firstElementChild).toHaveAttribute(
        `data-${tokenGroups[group].path}`,
        'airy'
      );
    }
  );
});
