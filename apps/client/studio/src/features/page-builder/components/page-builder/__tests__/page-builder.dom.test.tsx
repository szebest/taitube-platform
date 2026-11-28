import { screen, waitFor, within } from '@testing-library/react';
import { stubRowGeometry } from '#app/__tests__/row-geometry';
import { renderPageBuilder } from '#app/features/page-builder/__tests__/render-page-builder';

const sectionsList = () => screen.getByRole('list', { name: 'Sections of this tab' });
const sectionTitles = () =>
  within(sectionsList())
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label'));

async function choose(
  user: Awaited<ReturnType<typeof renderPageBuilder>>['user'],
  name: string,
  option: string
) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('apps/client/studio: page builder', () => {
  beforeEach(stubRowGeometry);

  it('moves a section down with the keyboard and saves the new order', async () => {
    const { user, requests } = await renderPageBuilder();

    await user.click(within(sectionsList()).getByRole('button', { name: 'Reorder Start here' }));
    await user.keyboard('[Space]{ArrowDown}');
    await user.keyboard('[Space]');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(sectionTitles()).toEqual(['Latest uploads', 'Start here']);
    await waitFor(() =>
      expect(requests.saved.at(-1)?.document.tabs[0]).toMatchObject({
        sections: [{ id: 'latest' }, { id: 'start-here' }],
      })
    );
  });

  it('edits a section source, sort and layout in its drawer, with the preview following', async () => {
    const { user, requests } = await renderPageBuilder();

    await user.click(screen.getByRole('button', { name: 'Edit Latest uploads' }));
    await choose(user, 'Source', 'Shorts');
    await choose(user, 'Sort', 'Most popular');
    await choose(user, 'Layout', 'Grid');

    expect(await screen.findByText('Columns: 3')).toBeInTheDocument();
    expect(document.querySelector('[data-layout="grid"]')).not.toBeNull();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(requests.saved.at(-1)?.document.tabs[0]).toMatchObject({
        sections: [
          { id: 'start-here' },
          {
            id: 'latest',
            source: { type: 'shorts' },
            sort: 'popular',
            layout: { type: 'grid', columns: 3 },
          },
        ],
      })
    );
  });

  it('asks before replacing the draft with a template, and publishes nothing', async () => {
    const { user, requests } = await renderPageBuilder();

    await user.click(screen.getByRole('button', { name: 'Templates' }));
    await user.click(await screen.findByRole('radio', { name: 'Series-focused' }));
    await user.click(screen.getByRole('button', { name: 'Replace my draft' }));

    expect(sectionTitles()).toEqual(['The newest episode', 'The series', 'Start here']);
    expect(screen.getByRole('button', { name: 'Episodes' })).toBeInTheDocument();
    expect(requests.published).toEqual([]);
  });
});
