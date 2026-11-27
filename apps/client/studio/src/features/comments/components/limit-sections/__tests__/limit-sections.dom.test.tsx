import { screen, within } from '@testing-library/react';
import {
  renderSettings,
  SETTINGS,
  sectionOf,
} from '#app/features/comments/__tests__/render-settings';

describe('apps/client/studio: the limit sections', () => {
  it.each([
    {
      section: 'Slow mode',
      label: 'Wait between comments',
      picked: '30 seconds',
      change: { slowModeSeconds: 30 },
    },
    {
      section: 'Slow mode',
      label: 'Wait between comments',
      picked: 'Off',
      change: { slowModeSeconds: null },
      from: { slowModeSeconds: 60 },
    },
    {
      section: 'Account age',
      label: 'Minimum account age',
      picked: '7 days',
      change: { minAccountAgeDays: 7 },
    },
  ])(
    'saves $change when $picked is picked in $section',
    async ({ section, label, picked, change, from }) => {
      const { user, sent } = await renderSettings({ settings: { ...SETTINGS, ...from } });
      const block = within(sectionOf(section));

      await user.click(block.getByRole('combobox', { name: label }));
      await user.click(await screen.findByRole('option', { name: picked }));
      await user.click(block.getByRole('button', { name: 'Save' }));

      await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
      expect(sent.saves[0]).toMatchObject(change);
    }
  );

  it('shows the stored slow mode and age', async () => {
    await renderSettings({
      settings: { ...SETTINGS, slowModeSeconds: 300, minAccountAgeDays: 14 },
    });

    expect(within(sectionOf('Slow mode')).getByRole('combobox')).toHaveTextContent('5 minutes');
    expect(within(sectionOf('Account age')).getByRole('combobox')).toHaveTextContent('14 days');
  });

  it('saves subscribers only on its own', async () => {
    const { user, sent } = await renderSettings();
    const block = within(sectionOf('Subscribers only'));

    await user.click(block.getByRole('switch', { name: 'Only subscribers can comment' }));
    await user.click(block.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
    expect(sent.saves[0]).toMatchObject({ subscribersOnly: true, slowModeSeconds: null });
  });
});
