import { screen } from '@testing-library/react';
import { account } from '@vp/web-testing';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => {
  const { StubPlayer } = await import('#app/features/watch/__tests__/stub-player');
  return { ...(await importOriginal()), TaitubePlayer: StubPlayer, TaitubePreview: StubPlayer };
});

describe('apps/client/web: Clip action', () => {
  it('sends a guest to sign-in and opens no dialog', async () => {
    const { user, router } = await renderWatch({ video: { durationMs: 120_000 } });

    await user.click(screen.getByRole('button', { name: 'Clip' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
