import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { z } from 'zod';

function ModerationPage() {
  const { tOr } = useT();

  return (
    <EmptyState.Root>
      <EmptyState.Title>{tOr('studio.adminModerationSoon', {}, '')}</EmptyState.Title>
    </EmptyState.Root>
  );
}

export const Route = createFileRoute('/_authed/admin/moderation')({
  validateSearch: z.object({}),
  component: ModerationPage,
});
