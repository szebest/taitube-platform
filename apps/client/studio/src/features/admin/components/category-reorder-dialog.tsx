import { useT } from '@vp/intl-react';
import { Dialog, SortableList, useToast } from '@vp/ui';

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
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.adminCategoryReorderTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>
            {tOr('studio.adminCategoryReorderDescription', {}, '')}
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <SortableList.Root items={categories.map(({ id }) => id)} onReorder={save}>
            {categories.map((category) => (
              <SortableList.Item key={category.id} id={category.id} aria-label={category.name}>
                <SortableList.Handle />
                <span className="tw:text-label">{category.name}</span>
              </SortableList.Item>
            ))}
          </SortableList.Root>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
