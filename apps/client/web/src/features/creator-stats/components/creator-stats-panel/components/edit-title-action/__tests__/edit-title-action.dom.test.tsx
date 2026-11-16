import { screen, waitFor } from '@testing-library/react';
import { getVideo, updateCreatorVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, apiServer, mockEndpoint, problemReply, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const SAVED_VERSION = 4;

function renderEditor(answer: () => Response | Promise<Response>) {
  const bodies: unknown[] = [];
  const rendered = renderPanel({
    viewer: account(),
    handlers: [
      mockEndpoint(updateCreatorVideo, async ({ request }) => {
        bodies.push(await request.json());
        return answer() as never;
      }),
    ],
  });
  return { rendered, bodies };
}

const saved = () => HttpResponse.json(video({ title: 'Renamed', version: SAVED_VERSION }));
const openEditor = async (user: Awaited<ReturnType<typeof renderPanel>>['user']) => {
  await user.click(await screen.findByRole('button', { name: 'Edit title' }));
  return screen.findByRole('textbox', { name: 'Video title' });
};

describe('apps/client/web: EditTitleAction', () => {
  it('edits the title in place and saves it on Enter with the version the page holds', async () => {
    const { rendered, bodies } = renderEditor(saved);
    const { user } = await rendered;

    const input = await openEditor(user);
    expect(input).toHaveValue('Launch day');
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    await waitFor(() => expect(bodies).toEqual([{ title: 'Renamed', version: 3 }]));
    expect(await screen.findByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Renamed' })).toBeInTheDocument();
  });

  it('cancels on Escape and sends nothing', async () => {
    const { rendered, bodies } = renderEditor(saved);
    const { user } = await rendered;

    const input = await openEditor(user);
    await user.type(input, ' edited{Escape}');

    expect(screen.queryByRole('textbox', { name: 'Video title' })).not.toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('says the video moved on when the version is stale, and reloads it on request', async () => {
    const { rendered } = renderEditor(() => problemReply(ErrorCodes.VERSION_CONFLICT));
    const { user } = await rendered;
    let reloads = 0;
    apiServer.use(
      mockEndpoint(getVideo, () => {
        reloads += 1;
        return HttpResponse.json(video({ title: 'Changed elsewhere', version: 9 }));
      })
    );

    const input = await openEditor(user);
    await user.type(input, '!{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This video was changed somewhere else');
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(reloads).toBeGreaterThan(0));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Changed elsewhere' })
    ).toBeInTheDocument();
  });
});
