import { screen, waitFor } from '@testing-library/react';
import { forkPlaylist, freezePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useCopyPlaylist } from '../use-copy-playlist';

const LIST = uuid(4100);
const COPY = uuid(4900);

function CopyButton({ copy }: { copy: 'fork' | 'freeze' }) {
  const { mutate } = useCopyPlaylist(LIST, copy);
  return <button onClick={() => mutate()}>Copy</button>;
}

async function renderCopy(copy: 'fork' | 'freeze', refused = false) {
  const asked: string[] = [];
  const reply =
    (kind: string) =>
    ({ params }: { params: Record<string, unknown> }): Response => {
      asked.push(`${kind} ${params.id}`);
      return refused
        ? problemReply(ErrorCodes.INTERNAL)
        : HttpResponse.json(playlistDetail(COPY, [], { title: 'Road trips (copy)' }), {
            status: 201,
          });
    };
  const client = createQueryClient();
  client.setQueryData(libraryKeys.playlists(), { items: [] });
  const rendered = await renderPart(<CopyButton copy={copy} />, {
    client,
    handlers: [
      mockEndpoint(forkPlaylist, reply('fork')),
      mockEndpoint(freezePlaylist, reply('freeze')),
    ],
  });
  return { ...rendered, asked };
}

describe('apps/client/web: useCopyPlaylist', () => {
  it.each([
    { copy: 'fork', toast: 'Your copy Road trips (copy) is ready' },
    { copy: 'freeze', toast: 'Saved what it holds now as Road trips (copy)' },
  ] as const)('$copy makes the copy, says so and opens it', async ({ copy, toast }) => {
    const { user, router, client, asked } = await renderCopy(copy);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(toast)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toMatchObject({ list: COPY }));
    expect(router.state.location.pathname).toBe('/playlist');
    expect(asked).toEqual([`${copy} ${LIST}`]);
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });

  it('stays where it is and says so when the server refuses', async () => {
    const { user, router } = await renderCopy('fork', true);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/');
  });
});
