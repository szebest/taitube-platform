import { renderPage } from '#app/__tests__/render-page';
import { categoriesQueryOptions } from '#app/features/categories/api/category-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { CategoryList } from '../category-list';

const MUSIC_ID = '0190c3a0-5e1d-7000-8000-00000000d001';

const music = {
  id: MUSIC_ID,
  slug: 'music',
  name: 'Music',
  description: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function renderCategories(selectedCategoryId: string | undefined): Promise<string> {
  const queryClient = createQueryClient();
  queryClient.setQueryData(categoriesQueryOptions().queryKey, [music]);
  return renderPage(
    <CategoryList onCategoryChange={() => {}} selectedCategoryId={selectedCategoryId} />,
    { queryClient }
  );
}

describe('apps/client/web: category list', () => {
  it.each([
    { selectedCategoryId: undefined, selected: 'All', other: 'Music' },
    { selectedCategoryId: MUSIC_ID, selected: 'Music', other: 'All' },
  ])(
    'highlights $selected among the categories the API listed',
    async ({ selectedCategoryId, selected, other }) => {
      const markup = await renderCategories(selectedCategoryId);

      expect(markup).toContain(`class="btn btn-dark">${selected}<`);
      expect(markup).toContain(`class="btn btn-light">${other}<`);
    }
  );
});
