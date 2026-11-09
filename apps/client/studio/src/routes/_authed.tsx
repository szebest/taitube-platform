import { createFileRoute } from '@tanstack/react-router';
import { requireSignedIn } from '@vp/queries';
import { ensureActingChannel } from '#app/features/team';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async (options) => {
    requireSignedIn(options);
    await ensureActingChannel(options.context);
  },
});
