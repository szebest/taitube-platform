import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { z } from 'zod';

function QueuesPage() {
  const { tOr } = useT();

  return (
    <EmptyState.Root>
      <EmptyState.Title>{tOr('studio.adminQueuesSoon', {}, '')}</EmptyState.Title>
    </EmptyState.Root>
  );
}

export const Route = createFileRoute('/_authed/admin/queues')({
  validateSearch: z.object({}),
  component: QueuesPage,
});
