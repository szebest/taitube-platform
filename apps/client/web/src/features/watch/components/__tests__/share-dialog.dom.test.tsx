import { screen, within } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const LINK = `http://localhost:3000/watch/${VIDEO_ID}`;

async function openShare() {
  const rendered = await renderWatch();
  await rendered.user.click(screen.getByRole('button', { name: 'Share' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Share this video' }) };
}

describe('apps/client/web: share dialog', () => {
  it.each([
    { scenario: 'without the time', startAt: false, copied: LINK },
    { scenario: 'with the time the player is at', startAt: true, copied: `${LINK}?t=75` },
  ])('copies the link  and says so', async ({ startAt, copied }) => {
    const { user, dialog } = await openShare();
    if (startAt) {
      await user.click(within(dialog).getByRole('checkbox', { name: 'Start at 01:15' }));
    }
    expect(within(dialog).getByRole('textbox', { name: 'Link' })).toHaveValue(copied);

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(copied);
  });

  it('says so when the link cannot be copied', async () => {
    const { user, dialog } = await openShare();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('The link could not be copied')).toBeInTheDocument();
  });
});
