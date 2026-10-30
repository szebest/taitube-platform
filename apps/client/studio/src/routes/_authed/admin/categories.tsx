import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { z } from 'zod';

function CategoriesPage() {
  const { tOr } = useT();

  return (
    <EmptyState.Root>
      <EmptyState.Title>{tOr('studio.adminTabCategories', {}, '')}</EmptyState.Title>
    </EmptyState.Root>
  );
}

export const Route = createFileRoute('/_authed/admin/categories')({
  validateSearch: z.object({}),
  component: CategoriesPage,
});
