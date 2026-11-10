import { within } from '@testing-library/react';
import {
  renderSettings,
  SETTINGS,
  sectionOf,
} from '#app/features/comments/__tests__/render-settings';

describe('apps/client/studio: ReviewModeSection', () => {
  it('offers the three modes with the stored one picked', async () => {
    await renderSettings({ settings: { ...SETTINGS, reviewMode: 'links' } });

    const modes = within(sectionOf('Review')).getAllByRole('radio');

    expect(modes.map((mode) => mode.textContent)).toEqual(['Nothing', 'Links', 'Everything']);
    expect(within(sectionOf('Review')).getByRole('radio', { name: 'Links' })).toBeChecked();
  });

  it.each([
    { picked: 'Everything', reviewMode: 'all' },
    { picked: 'Links', reviewMode: 'links' },
  ])(
    'saves $reviewMode when $picked is picked, the rest as it was',
    async ({ picked, reviewMode }) => {
      const { user, sent } = await renderSettings();
      const section = within(sectionOf('Review'));

      await user.click(section.getByRole('radio', { name: picked }));
      await user.click(section.getByRole('button', { name: 'Save' }));

      await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
      expect(sent.saves[0]).toMatchObject({
        reviewMode,
        blockedWords: ['spoiler'],
        slowModeSeconds: null,
      });
    }
  );
});
