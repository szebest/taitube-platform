import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { type AdminCategory, adminCategoryKeys } from '#app/features/admin/api/admin-categories';

/** The categories in `ordered`, numbered from 0 by their place. */
function renumbered(ordered: readonly AdminCategory[]): AdminCategory[] {
  return ordered.map((category, sortOrder) => ({ ...category, sortOrder }));
}

/** Saves a new display order by patching only the categories whose place changed, optimistically. */
export function useReorderCategories() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: async (ordered: readonly AdminCategory[]) => {
        const moved = renumbered(ordered).filter(
          (category, place) => category.sortOrder !== ordered[place]?.sortOrder
        );
        await Promise.all(
          moved.map(({ id, sortOrder }) =>
            api.adminCategories.updateCategory({ params: { id }, body: { sortOrder } })
          )
        );
      },
      onMutate: async (ordered, { client }) => {
        await client.cancelQueries({ queryKey: adminCategoryKeys.all });
        const previous = client.getQueryData<AdminCategory[]>(adminCategoryKeys.all);
        client.setQueryData(adminCategoryKeys.all, renumbered(ordered));
        return { previous };
      },
      onError: (_error, _ordered, snapshot, { client }) =>
        client.setQueryData(adminCategoryKeys.all, snapshot?.previous),
      onSettled: (_data, _error, _ordered, _snapshot, { client }) =>
        client.invalidateQueries({ queryKey: adminCategoryKeys.all }),
    })
  );
}
