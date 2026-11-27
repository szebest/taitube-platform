import { screen, within } from '@testing-library/react';
import { renderSettings } from '#app/features/comments/__tests__/render-settings';

const MARTA = {
  userId: '0190c3a0-5e1d-7000-8000-00000000b001',
  createdBy: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  user: { handle: 'marta', displayName: 'Marta', avatarUrl: null },
};

const section = () => within(screen.getByRole('region', { name: 'Trusted commenters' }));

describe('apps/client/studio: TrustedCommentersSection', () => {
  it('says nobody is trusted', async () => {
    await renderSettings();

    expect(await section().findByText('Nobody is trusted yet.')).toBeInTheDocument();
  });

  it('lists a trusted commenter and stops trusting them', async () => {
    const { user, sent } = await renderSettings({ trusted: [MARTA] });

    await user.click(await section().findByRole('button', { name: 'Stop trusting Marta' }));

    await vi.waitFor(() => expect(sent.untrusted).toEqual([MARTA.userId]));
    expect(await section().findByText('Nobody is trusted yet.')).toBeInTheDocument();
  });

  it('names a commenter without a channel by their id', async () => {
    await renderSettings({ trusted: [{ ...MARTA, user: null }] });

    expect(await section().findByText(MARTA.userId)).toBeInTheDocument();
  });
});
