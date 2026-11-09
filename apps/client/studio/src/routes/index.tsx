import { createFileRoute, redirect } from '@tanstack/react-router';
import { AccessDeniedSearchSchema } from '#app/utils/access-denied-search';

export const Route = createFileRoute('/')({
  validateSearch: AccessDeniedSearchSchema,
  beforeLoad: () => {
    throw redirect({ to: '/videos', search: true, replace: true });
  },
});
