import { screen, waitFor, within } from '@testing-library/react';
import { addPlaylistSection, editPlaylistItem } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { annotatedPlaylist, NIGHT } from '#app/features/library/__tests__/annotated-playlist';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LIST } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistSectionDialog } from '../playlist-section-dialog.lazy';

/** The section dialog opened from `search`, every write recorded as `METHOD body`. */
const renderSectionDialog = async (search: string) => {
  const writes: string[] = [];
  const rendered = await renderLibrary(`/playlist?list=${LIST}&modal=playlist-section${search}`, {
    details: [annotatedPlaylist()],
    handlers: [
      mockEndpoint(addPlaylistSection, async ({ request }) => {
        writes.push(`POST ${JSON.stringify(await request.clone().json())}`);
        return HttpResponse.json({ id: uuid(6100) }, { status: 201 });
      }),
      mockEndpoint(editPlaylistItem, async ({ request, params }) => {
        writes.push(
          `PATCH ${String(params.itemId)} ${JSON.stringify(await request.clone().json())}`
        );
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, writes };
};

describe('apps/client/web: the section dialog', () => {
  beforeAll(() => LazyPlaylistSectionDialog.preload());

  it.each([
    { mode: 'adds', search: '', title: 'Add a section', write: 'POST {"title":"Late"}' },
    {
      mode: 'renames',
      search: `&sectionId=${NIGHT}`,
      title: 'Rename section',
      write: `PATCH ${NIGHT} {"title":"Late"}`,
    },
  ])('$mode a section by its title', async ({ search, title, write }) => {
    const { user, writes } = await renderSectionDialog(search);

    const dialog = within(await screen.findByRole('dialog', { name: title }));
    const field = dialog.getByRole('textbox', { name: 'Section title' });
    await user.clear(field);
    await user.type(field, 'Late');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toEqual([write]));
    expect(await screen.findByText('Section saved')).toBeInTheDocument();
  });

  it('keeps Save off for a title longer than 80 characters', async () => {
    const { user } = await renderSectionDialog('');

    const dialog = within(await screen.findByRole('dialog', { name: 'Add a section' }));
    await user.type(dialog.getByRole('textbox', { name: 'Section title' }), 'x'.repeat(81));

    expect(await dialog.findByText('Use 1 to 80 characters')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
