import { createFileRoute } from '@tanstack/react-router';
import { TeamSearchSchema } from '#app/features/team/api/team-search';
import { TeamPage } from '#app/features/team/components/team-page/team-page';

export const Route = createFileRoute('/_authed/team')({
  validateSearch: TeamSearchSchema,
  component: TeamPage,
});
