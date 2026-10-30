import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { TOKEN_GROUPS, type TokenGroup, tokenGroups } from '@vp/design-tokens';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';

import { AppProviders } from '#app/__tests__/providers';
import { SETTING_ROWS } from '#app/features/settings/settings-index';
import { SetPreview } from '../token-group-map';

const SETS_CSS = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../../../../../packages/client/ui/src/styles/generated/sets.css'
  ),
  'utf8'
);

const renderPreview = (group: TokenGroup, setId: string, mode: 'dark' | 'light' = 'dark') =>
  render(
    <AppProviders>
      <AppearanceProvider stored={{ preference: { ...DEFAULT_APPEARANCE, mode }, source: 'none' }}>
        <SetPreview group={group} setId={setId} />
      </AppearanceProvider>
    </AppProviders>
  );

describe('apps/client/web: the token group map', () => {
  it('has a row of the advanced page for every group of the registry', () => {
    expect(
      SETTING_ROWS.filter(({ section }) => section === 'advanced')
        .map(({ id }) => id)
        .sort()
    ).toEqual([...TOKEN_GROUPS].sort());
  });

  it.each(TOKEN_GROUPS.map((group) => ({ group })))(
    'scopes the $group preview by its set attribute',
    ({ group }) => {
      const { container } = renderPreview(group, 'airy');

      expect(container.firstElementChild).toHaveAttribute(
        `data-${tokenGroups[group].path}`,
        'airy'
      );
    }
  );

  it.each(
    (['dark', 'light'] as const).flatMap((mode) =>
      (
        [
          { group: 'shadow', setId: 'flat' },
          { group: 'shadow', setId: 'soft' },
          { group: 'shadow', setId: 'deep' },
          { group: 'ambient', setId: 'off' },
          { group: 'ambient', setId: 'subtle' },
          { group: 'ambient', setId: 'cinematic' },
        ] as { group: TokenGroup; setId: string }[]
      ).map((row) => ({ ...row, mode }))
    )
  )('matches the generated $group rule of $setId in $mode mode', ({ group, setId, mode }) => {
    const { container } = renderPreview(group, setId, mode);
    const preview = container.firstElementChild as HTMLElement;
    const path = tokenGroups[group].path;
    const selectors = SETS_CSS.split('\n')
      .filter((line) => line.startsWith(`[data-${path}="${setId}"]`) && line.endsWith(' {'))
      .map((line) => line.slice(0, -2));

    expect(preview.dataset.mode).toBe(mode);
    expect(selectors.some((selector) => preview.matches(selector))).toBe(true);
  });
});
