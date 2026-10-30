import { useT } from '@vp/intl-react';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';

import type { AdminCategory } from '#app/features/admin/api/admin-categories';
import {
  useDeleteCategory,
  useUpdateCategory,
} from '#app/features/admin/hooks/use-category-mutations';

export interface CategoryDeleteDialogProps {
  category: AdminCategory;
  onClose: () => void;
}

/**
 * Asks before deleting an empty category. One that videos still use cannot be deleted (the API
 * answers 409), so it says how many and offers to deactivate it instead.
 */
export function CategoryDeleteDialog({ category, onClose }: CategoryDeleteDialogProps) {
  const { tOr } = useT();
  const { cancel, delete: remove } = useUiCopy();
  const toast = useToast();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();
  const { name, videoCount } = category;
  const inUse = videoCount > 0;

  const confirm = async () => {
    try {
      await (inUse
        ? updateCategory.mutateAsync({ id: category.id, changes: { isActive: false } })
        : deleteCategory.mutateAsync(category.id));
    } catch {
      toast({ tone: 'danger', title: tOr('studio.adminCategoryDeleteFailed', {}, '') });
    }
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>
          {inUse
            ? tOr('studio.adminCategoryInUseTitle', { name }, '')
            : tOr('studio.adminCategoryDeleteTitle', { name }, '')}
        </AlertDialog.Title>
        <AlertDialog.Description>
          {inUse
            ? tOr('studio.adminCategoryInUseDescription', { name, count: videoCount }, '')
            : tOr('studio.adminCategoryDeleteDescription', { name }, '')}
        </AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          {inUse && category.isActive && (
            <AlertDialog.Action asChild>
              <Button variant="solid" tone="accent" onClick={confirm}>
                {tOr('studio.adminCategoryDeactivate', {}, '')}
              </Button>
            </AlertDialog.Action>
          )}
          {!inUse && (
            <AlertDialog.Action asChild>
              <Button variant="solid" tone="danger" onClick={confirm}>
                {remove}
              </Button>
            </AlertDialog.Action>
          )}
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
