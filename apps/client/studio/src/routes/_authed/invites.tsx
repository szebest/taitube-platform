import { createFileRoute } from '@tanstack/react-router';
import { InvitesPage, InvitesSearchSchema } from '#app/features/team';

export const Route = createFileRoute('/_authed/invites')({
  validateSearch: InvitesSearchSchema,
  component: InvitesPage,
});
