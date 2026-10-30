import { screen, within } from '@testing-library/react';
import { PREFERS_REDUCED_MOTION, readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAccessibility = () => renderRoute(getRouter, '/settings/accessibility');

const savedAppearance = () => JSON.parse(readCookie('vp.appearance') ?? 'null');

const row = async (name: string) => within(await screen.findByRole('group', { name }));

describe('apps/client/web: the accessibility appearance rows', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it.each([
    {
      scenario: 'font size',
      row: 'Font size',
      choice: 'Large',
      attribute: 'fontSize',
      value: 'large',
    },
    {
      scenario: 'motion',
      row: 'Reduce motion',
      choice: 'Calm',
      attribute: 'motion',
      value: 'calm',
    },
  ])('applies the $scenario chosen at once and keeps it as the override', async (change) => {
    const { user } = await renderAccessibility();

    await user.click((await row(change.row)).getByRole('radio', { name: change.choice }));

    expect(document.documentElement.dataset[change.attribute]).toBe(change.value);
    expect(savedAppearance().overrides[change.attribute]).toBe(change.value);
  });

  it('turns more contrast and bold borders on and off', async () => {
    const { user } = await renderAccessibility();
    const contrast = (await row('Contrast')).getByRole('switch', { name: 'More contrast' });
    const borders = (await row('Bold borders')).getByRole('switch', { name: 'Bold borders' });

    await user.click(contrast);
    await user.click(borders);
    expect(document.documentElement.dataset.contrast).toBe('more');
    expect(document.documentElement.dataset.border).toBe('bold');

    await user.click(contrast);
    await user.click(borders);
    expect(document.documentElement.dataset.contrast).toBe('standard');
    expect(document.documentElement.dataset.border).toBe('hairline');
    expect(savedAppearance().overrides.border).toBeUndefined();
  });

  it('says the system request to reduce motion always wins, when there is one', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      media: query,
      matches: query === PREFERS_REDUCED_MOTION,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));

    await renderAccessibility();

    expect(
      await screen.findByText(/Your system asks for reduced motion, which always wins/)
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('holds the same values the advanced page holds, whichever page set them', async () => {
    const { user, router } = await renderAccessibility();
    await user.click((await row('Font size')).getByRole('radio', { name: 'Large' }));
    await user.click((await row('Reduce motion')).getByRole('radio', { name: 'Calm' }));
    await user.click((await row('Bold borders')).getByRole('switch', { name: 'Bold borders' }));

    await router.navigate({ to: '/settings/appearance/advanced' });

    expect((await row('Text size')).getByRole('radio', { name: 'Large' })).toBeChecked();
    expect((await row('Motion')).getByRole('radio', { name: 'Calm' })).toBeChecked();
    expect((await row('Borders')).getByRole('radio', { name: 'Bold' })).toBeChecked();

    await user.click((await row('Text size')).getByRole('radio', { name: 'Small' }));
    await router.navigate({ to: '/settings/accessibility' });

    expect((await row('Font size')).getByRole('radio', { name: 'Small' })).toBeChecked();
  });
});
