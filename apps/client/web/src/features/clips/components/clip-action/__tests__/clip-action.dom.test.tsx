import { screen } from '@testing-library/react';
import { account } from '@vp/web-testing';
import { renderWatch } from '#app/__tests__/render-watch';
import { LazyClipDialog } from '#app/features/clips/components/clip-dialog/clip-dialog.lazy';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

vi.mock(import('#app/components/player/taitube-preview/taitube-preview'), async () => ({
  TaitubePreview: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

beforeAll(() => LazyClipDialog.preload());

describe('apps/client/web: Clip action', () => {
  it('asks a guest to sign in, on the same page, and opens no clip dialog', async () => {
    const { user, router } = await renderWatch({ video: { durationMs: 120_000 } });
    const page = router.state.location.pathname;

    await user.click(screen.getByRole('button', { name: 'Clip' }));

    expect(
      await screen.findByRole('dialog', { name: 'Sign in to make a clip' })
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(page);
    expect(screen.queryByRole('dialog', { name: 'Clip this video' })).not.toBeInTheDocument();
  });

  it('opens the dialog for a signed-in viewer', async () => {
    const { user } = await renderWatch({ viewer: account(), video: { durationMs: 120_000 } });

    await user.click(screen.getByRole('button', { name: 'Clip' }));

    expect(await screen.findByRole('dialog', { name: 'Clip this video' })).toBeInTheDocument();
  });

  it.each([
    { video: 'a private one', overrides: { visibility: 'private' as const, durationMs: 120_000 } },
    {
      video: 'an unlisted one',
      overrides: { visibility: 'unlisted' as const, durationMs: 120_000 },
    },
    { video: 'one with no duration yet', overrides: { durationMs: undefined } },
    { video: 'one shorter than a clip', overrides: { durationMs: 4000 } },
  ])('is not offered on $video', async ({ overrides }) => {
    await renderWatch({ viewer: account(), video: overrides });

    expect(screen.queryByRole('button', { name: 'Clip' })).not.toBeInTheDocument();
  });
});
