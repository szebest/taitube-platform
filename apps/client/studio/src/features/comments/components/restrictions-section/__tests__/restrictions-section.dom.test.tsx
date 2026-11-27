import { screen, within } from '@testing-library/react';
import { renderSettings } from '#app/features/comments/__tests__/render-settings';

const base = {
  createdBy: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  user: null,
};

const SHADOW = {
  ...base,
  userId: '0190c3a0-5e1d-7000-8000-00000000b001',
  kind: 'shadow' as const,
  reason: null,
  expiresAt: null,
};
const BAN = {
  ...base,
  userId: '0190c3a0-5e1d-7000-8000-00000000b002',
  kind: 'ban' as const,
  reason: 'Spam',
  expiresAt: '2026-12-01T10:00:00.000Z',
  user: { handle: 'tomek', displayName: 'Tomek', avatarUrl: null },
};
const FOREVER = {
  ...BAN,
  userId: '0190c3a0-5e1d-7000-8000-00000000b003',
  expiresAt: null,
  reason: null,
};

const section = () => within(screen.getByRole('region', { name: 'Restrictions' }));

describe('apps/client/studio: RestrictionsSection', () => {
  it('says nobody is restricted', async () => {
    await renderSettings();

    expect(await section().findByText('Nobody is restricted.')).toBeInTheDocument();
  });

  it('shows the kind, the end and the reason of each restriction', async () => {
    await renderSettings({ restrictions: [SHADOW, BAN, FOREVER] });

    const items = await section().findAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Shadow ban'),
      expect.stringMatching(/Tomek.*Ban.*Until Dec 1, 2026 · Spam/),
      expect.stringMatching(/Ban.*Until lifted/),
    ]);
  });

  it('lifts a restriction and tells so', async () => {
    const { user, sent } = await renderSettings({ restrictions: [BAN] });

    await user.click(
      await section().findByRole('button', { name: 'Lift the restriction on Tomek' })
    );

    await vi.waitFor(() => expect(sent.lifted).toEqual([BAN.userId]));
    expect(await screen.findByText('The restriction is lifted')).toBeInTheDocument();
    expect(await section().findByText('Nobody is restricted.')).toBeInTheDocument();
  });
});
