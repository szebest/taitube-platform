import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { type ActingRole, roleHas } from '@vp/domain';
import { forgetChannelData } from '#app/features/team/api/ensure-acting-channel';

function landingFor(role: ActingRole) {
  if (roleHas(role, 'video.edit')) return '/videos';
  if (roleHas(role, 'comment.moderate')) return '/comments';
  return '/analytics';
}

/** Moves the studio to another channel, or back to the viewer's own with `undefined`, and onto a page their role there reaches. */
export function useSwitchChannel() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async (channelId: string | undefined, role: ActingRole) => {
    router.options.context.actingChannel.select(channelId);
    forgetChannelData(queryClient);
    await router.navigate({ to: landingFor(role), search: {} });
  };
}
