import { createFileRoute } from '@tanstack/react-router';
import { TeamPage, TeamSearchSchema } from '#app/features/team';

export const Route = createFileRoute('/_authed/team')({
  validateSearch: TeamSearchSchema,
  component: TeamPage,
});
