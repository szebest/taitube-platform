import { screen, within } from '@testing-library/react';
import { deleteClip } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, CLIP_ID, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { renderClip } from '#app/features/clips/__tests__/render-clip';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

async function askToDelete(handler: ReturnType<typeof mockEndpoint>) {
  const rendered = await renderClip({ viewer: account(), handlers: [handler] });
  await rendered.user.click(screen.getByRole('button', { name: 'Delete clip' }));
  return {
    ...rendered,
    confirm: await screen.findByRole('alertdialog', { name: 'Delete this clip?' }),
  };
}

describe('apps/client/web: deleting a clip', () => {
  it('deletes it once confirmed, says so and goes back to the video', async () => {
    const removed: unknown[] = [];
    const { user, confirm, router } = await askToDelete(
      mockEndpoint(deleteClip, ({ params }) => {
        removed.push(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );

    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Clip deleted')).toBeInTheDocument();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/watch/${VIDEO_ID}`));
    expect(removed).toEqual([CLIP_ID]);
  });

  it('keeps the clip when the viewer cancels', async () => {
    const removed = vi.fn();
    const { user, confirm, router } = await askToDelete(
      mockEndpoint(deleteClip, () => {
        removed();
        return new HttpResponse(null, { status: 204 });
      })
    );

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect([removed.mock.calls.length, router.state.location.pathname]).toEqual([
      0,
      `/clip/${CLIP_ID}`,
    ]);
  });

  it('says so when the clip could not be deleted, and stays on it', async () => {
    const { user, confirm, router } = await askToDelete(
      mockEndpoint(deleteClip, () => problemReply(ErrorCodes.INTERNAL))
    );

    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('The clip could not be deleted')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/clip/${CLIP_ID}`);
  });
});
