import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor, within } from '@testing-library/react';
import {
  changePlaylistCollaboratorRole,
  listPlaylistCollaborators,
  removePlaylistCollaborator,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import { collaborator, person, seated } from '#app/features/library/__tests__/playlist-people';
import { LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { CollaboratorRows } from '../collaborator-rows';

const ANA = collaborator(1, 'Ana', { role: 'contributor' });
const PLAYLIST = playlistDetail(LIST, [], { owner: person(0, 'Olga') });

async function renderRows(manageable: boolean) {
  const sent: string[] = [];
  const rendered = await renderPart(
    <CollaboratorRows playlist={PLAYLIST} manageable={manageable} />,
    {
      handlers: [
        seated([ANA]),
        mockEndpoint(changePlaylistCollaboratorRole, async ({ params, request }) => {
          sent.push(`role ${params.userId} ${JSON.stringify(await request.json())}`);
          return new HttpResponse(null, { status: 204 });
        }),
        mockEndpoint(removePlaylistCollaborator, ({ params }) => {
          sent.push(`remove ${params.userId}`);
          return new HttpResponse(null, { status: 204 });
        }),
      ],
    }
  );
  const list = await screen.findByRole('list', { name: 'People on this playlist' });
  return { ...rendered, list: within(list), sent };
}

describe('apps/client/web: the collaborator rows', () => {
  it('lists the owner first, then each collaborator, with controls the owner can use', async () => {
    const { user, list, sent } = await renderRows(true);
    const [owner, ana] = list.getAllByRole('listitem');

    expect(owner).toHaveTextContent('OlgaOwner');
    expect(ana).toHaveTextContent('Ana');
    expect(await axeViolations()).toEqual([]);

    await user.click(list.getByRole('combobox', { name: 'Role of Ana' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    await waitFor(() => expect(sent).toEqual([`role ${ANA.userId} {"role":"editor"}`]));

    await user.click(list.getByRole('button', { name: 'Remove Ana' }));
    await waitFor(() => expect(sent).toContain(`remove ${ANA.userId}`));
  });

  it('shows a reader each role and no controls', async () => {
    const { list } = await renderRows(false);

    expect(list.getAllByRole('listitem')[1]).toHaveTextContent(/Ana.*Contributor/);
    expect(list.queryByRole('combobox')).not.toBeInTheDocument();
    expect(list.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says the list could not be loaded, and loads it again on retry', async () => {
    let refused = true;
    const { user } = await renderPart(<CollaboratorRows playlist={PLAYLIST} manageable />, {
      handlers: [
        mockEndpoint(listPlaylistCollaborators, () =>
          refused ? problemReply(ErrorCodes.INTERNAL) : HttpResponse.json({ items: [ANA] })
        ),
      ],
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The collaborators could not be loaded');

    refused = false;
    await user.click(within(alert).getByRole('button'));

    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });
});
