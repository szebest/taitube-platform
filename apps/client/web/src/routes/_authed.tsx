import { createFileRoute } from '@tanstack/react-router';
import { requireSignedIn } from '@vp/queries';

export const Route = createFileRoute('/_authed')({
  beforeLoad: requireSignedIn,
});
