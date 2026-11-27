import { useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { saveSpotlightMutationOptions } from '#app/features/channel/api/channel-spotlight';
import { useActiveChannel } from '#app/hooks/use-active-channel';

export function useSaveSpotlight() {
  const { channelId } = useActiveChannel();
  return useMutation(saveSpotlightMutationOptions(useApi(), channelId));
}
