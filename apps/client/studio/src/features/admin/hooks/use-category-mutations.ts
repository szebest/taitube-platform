import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type { ContractBody, createCategory, updateCategory } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

import { adminCategoryKeys } from '#app/features/admin/api/admin-categories';

export type CategoryDraft = ContractBody<typeof createCategory>;
export type CategoryChanges = ContractBody<typeof updateCategory>;

const refetchCategories = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: adminCategoryKeys.all });

export function useCreateCategory() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: CategoryDraft) => api.adminCategories.createCategory({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchCategories(client),
    })
  );
}

export function useUpdateCategory() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, changes }: { id: string; changes: CategoryChanges }) =>
        api.adminCategories.updateCategory({ params: { id }, body: changes }),
      onSettled: (_data, _error, _variables, _snapshot, { client }) => refetchCategories(client),
    })
  );
}

export function useDeleteCategory() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.adminCategories.deleteCategory({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchCategories(client),
    })
  );
}
