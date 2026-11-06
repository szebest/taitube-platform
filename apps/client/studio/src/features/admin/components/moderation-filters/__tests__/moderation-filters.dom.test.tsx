import { screen } from '@testing-library/react';
import { adminCategory, categoriesList } from './categories.fixture';
import { adminVideo, renderModeration } from './moderation.fixture';

const lastQuery = (queries: URLSearchParams[]) => Object.fromEntries(queries.at(-1) ?? []);

const pick = async (
  user: Awaited<ReturnType<typeof renderModeration>>['user'],
  filter: string,
  option: string
) => {
  await user.click(screen.getByRole('combobox', { name: filter }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('apps/client/studio: ModerationFilters', () => {
  it.each([
    { filter: 'Status', option: 'Failed', param: 'status', value: 'FAILED' },
    { filter: 'Visibility', option: 'Private', param: 'visibility', value: 'private' },
  ])('narrows by $filter through the URL', async ({ filter, option, param, value }) => {
    const { user, requests, router } = await renderModeration('/admin/moderation', {
      videos: [[adminVideo()]],
    });
    await screen.findByRole('combobox', { name: filter });

    await pick(user, filter, option);

    await vi.waitFor(() =>
      expect(lastQuery(requests.videoQueries)).toMatchObject({ [param]: value })
    );
    expect(router.state.location.search).toMatchObject({ [param]: value });
  });

  it('narrows by a category the API lists', async () => {
    const music = adminCategory({ name: 'Music' });
    const { user, requests } = await renderModeration('/admin/moderation', {
      handlers: [categoriesList([music])],
    });
    await screen.findByRole('combobox', { name: 'Category' });

    await pick(user, 'Category', 'Music');

    await vi.waitFor(() =>
      expect(lastQuery(requests.videoQueries)).toMatchObject({ categoryId: music.id })
    );
  });

  it('searches titles on submit, trimmed, and clears the term when emptied', async () => {
    const { user, requests, router } = await renderModeration('/admin/moderation');
    const box = () => screen.findByRole('textbox', { name: 'Search titles' });

    await user.type(await box(), '  cats {Enter}');
    await vi.waitFor(() => expect(lastQuery(requests.videoQueries)).toMatchObject({ q: 'cats' }));

    await user.clear(await box());
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await vi.waitFor(() => expect(router.state.location.search).not.toHaveProperty('q'));
  });

  it('shows the filters the URL holds', async () => {
    await renderModeration('/admin/moderation?q=cats&status=READY');

    expect(await screen.findByRole('textbox', { name: 'Search titles' })).toHaveValue('cats');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Ready');
  });
});
