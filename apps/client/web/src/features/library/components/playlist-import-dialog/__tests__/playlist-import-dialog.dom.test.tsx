import { screen, within } from '@testing-library/react';
import { listPlaylistCollaborators } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST, VIDEOS } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistImportDialog } from '../playlist-import-dialog.lazy';

describe('apps/client/web: the import and export dialog', () => {
  beforeAll(() => LazyPlaylistImportDialog.preload());

  it.each([
    { viewer: 'the owner', ownerId: OWNER_ID, tabs: ['Import', 'Export'], selected: 'Import' },
    { viewer: 'a reader', ownerId: uuid(9001), tabs: ['Export'], selected: 'Export' },
  ])('gives $viewer the tabs they may use', async ({ ownerId, tabs, selected }) => {
    await renderLibrary(`/playlist?list=${LIST}&modal=playlist-import&direction=import`, {
      details: [playlistDetail(LIST, VIDEOS, { visibility: 'public', ownerId })],
      handlers: [mockEndpoint(listPlaylistCollaborators, () => problemReply(ErrorCodes.FORBIDDEN))],
    });

    const dialog = within(await screen.findByRole('dialog', { name: 'Import and export' }));
    expect(dialog.getAllByRole('tab').map(({ textContent }) => textContent)).toEqual(tabs);
    expect(dialog.getByRole('tab', { selected: true })).toHaveTextContent(selected);
  });

  it('keeps the picked tab in the URL without stacking history', async () => {
    const { user, router } = await renderLibrary(
      `/playlist?list=${LIST}&modal=playlist-import&direction=import`,
      { details: [playlistDetail(LIST, VIDEOS)] }
    );

    await user.click(await screen.findByRole('tab', { name: 'Export' }));

    expect(router.state.location.search).toMatchObject({ direction: 'export' });
    expect(await screen.findByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });
});
