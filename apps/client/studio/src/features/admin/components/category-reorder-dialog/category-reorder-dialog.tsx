import { useT } from '@vp/intl-react';
import { ResponsiveModal, SortableList, useToast } from '@vp/ui';
import type { AdminCategory } from '#app/features/admin/api/admin-categories';
import { useReorderCategories } from '#app/features/admin/hooks/use-reorder-categories';

export interface CategoryReorderDialogProps {
  /** In display order. */
  categories: readonly AdminCategory[];
  onClose: () => void;
}

/** The display order on a `SortableList`: pointer or keyboard, saved once on each drop. */
export function CategoryReorderDialog({ categories, onClose }: CategoryReorderDialogProps) {
  const { tOr } = useT();
  const toast = useToast();
  const reorder = useReorderCategories();
  const byId = new Map(categories.map((category) => [category.id, category]));

  const save = (ids: readonly string[]) => {
    const ordered = ids.flatMap((id) => byId.get(id) ?? []);
    reorder.mutate(ordered, {
      onError: () =>
        toast({ tone: 'danger', title: tOr('studio.adminCategoryReorderFailed', {}, '') }),
    });
  };

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModal.Content size="sm">
        <ResponsiveModal.Header>
          <ResponsiveModal.Title>
            {tOr('studio.adminCategoryReorderTitle', {}, '')}
          </ResponsiveModal.Title>
          <ResponsiveModal.Description>
            {tOr('studio.adminCategoryReorderDescription', {}, '')}
          </ResponsiveModal.Description>
        </ResponsiveModal.Header>
        <ResponsiveModal.Body>
          <SortableList.Root items={categories.map(({ id }) => id)} onReorder={save}>
            {categories.map((category) => (
              <SortableList.Item key={category.id} id={category.id} aria-label={category.name}>
                <SortableList.Handle />
                <span className="text-label">{category.name}</span>
              </SortableList.Item>
            ))}
          </SortableList.Root>
        </ResponsiveModal.Body>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
