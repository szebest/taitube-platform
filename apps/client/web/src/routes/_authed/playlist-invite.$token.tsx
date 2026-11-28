import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PlaylistInvitePage } from '#app/features/library';
import { validOrUndefined } from '#app/utils/valid-or-undefined';

function PlaylistInvite() {
  const { token } = Route.useParams();
  const { via } = Route.useSearch();

  return <PlaylistInvitePage token={token} personal={via === 'notification'} />;
}

export const Route = createFileRoute('/_authed/playlist-invite/$token')({
  validateSearch: z.object({ via: validOrUndefined(z.enum(['notification'])) }),
  component: PlaylistInvite,
});
