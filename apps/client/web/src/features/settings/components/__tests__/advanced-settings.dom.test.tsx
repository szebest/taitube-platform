import { screen, within } from '@testing-library/react';
import { TOKEN_GROUPS } from '@vp/design-tokens';
import { writeCookie } from '@vp/ui';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

vi.mock(import('@vp/ui/appearance/registry'), async (importOriginal) =>
  (await import('../../__tests__/extended-registry')).extendRegistry(await importOriginal())
);

const renderAdvanced = () => renderRoute(getRouter, '/settings/appearance/advanced');

const row = async (name: string) => within(await screen.findByRole('group', { name }));

const shown = (name: 'spacing' | 'radius') => document.documentElement.dataset[name];

describe('apps/client/web: the advanced appearance settings', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('lists the groups of the registry as rows, and the set added to it among its choices', async () => {
    await renderAdvanced();

    const groups = await screen.findAllByRole('group');

    expect(groups.map(({ id }) => id).filter(Boolean)).toEqual([...TOKEN_GROUPS]);
    expect((await row('Corners')).getByRole('radio', { name: 'Pill' })).toBeInTheDocument();
    expect(
      (await row('Corners')).getByRole('radio', { name: 'Theme default (Round)' })
    ).toBeChecked();
  });

  it('marks a change, applies it to the app, and takes it back with the row reset', async () => {
    const { user } = await renderAdvanced();
    const spacing = await row('Spacing');
    expect(spacing.queryByText('Changed')).toBeNull();

    await user.click(spacing.getByRole('radio', { name: 'Airy' }));

    expect(spacing.getByText('Changed')).toBeInTheDocument();
    expect(shown('spacing')).toBe('airy');

    await user.click(spacing.getByRole('button', { name: 'Reset Spacing to the theme default' }));

    expect(spacing.queryByText('Changed')).toBeNull();
    expect(shown('spacing')).toBe('default');
    expect(spacing.getByRole('radio', { name: 'Theme default (Default)' })).toBeChecked();
  });

  it('takes every change back with Reset all, which waits until there is one', async () => {
    const { user } = await renderAdvanced();
    const resetAll = await screen.findByRole('button', {
      name: "Reset all to the theme's defaults",
    });
    expect(resetAll).toBeDisabled();

    await user.click((await row('Spacing')).getByRole('radio', { name: 'Airy' }));
    await user.click((await row('Corners')).getByRole('radio', { name: 'Sharp' }));
    expect(resetAll).toBeEnabled();
    await user.click(resetAll);

    expect([shown('spacing'), shown('radius')]).toEqual(['default', 'round']);
    expect(screen.queryByText('Changed')).toBeNull();
  });

  it('draws the preview of the whole beside the rows', async () => {
    await renderAdvanced();

    const preview = await screen.findByRole('complementary', { name: 'Preview' });

    expect(within(preview).getByText('Up next')).toBeInTheDocument();
    expect(within(preview).getByText('Subscribe')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderAdvanced();
    await screen.findByRole('complementary', { name: 'Preview' });

    expect(await axeViolations()).toEqual([]);
  });
});
