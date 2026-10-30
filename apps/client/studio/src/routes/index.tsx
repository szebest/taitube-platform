import { createFileRoute, redirect } from '@tanstack/react-router';

import { AccessDeniedSearchSchema } from '#app/features/shell/access-denied-search';

export const Route = createFileRoute('/')({
  validateSearch: AccessDeniedSearchSchema,
  beforeLoad: () => {
    throw redirect({ to: '/upload', search: true, replace: true });
  },
});
