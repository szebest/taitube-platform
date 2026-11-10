import { useQuery } from '@tanstack/react-query';
import type { DisclosureDefaults } from '@vp/domain';
import { canReadCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { commentSettingsQueryOptions, useApi } from '@vp/queries';
import { useModerationChannel } from './use-moderation-channel';

/** The channel's disclosure defaults, or undefined while loading and for a viewer who may not read the settings. */
export function useDisclosureDefaults(): DisclosureDefaults | undefined {
  const api = useApi();
  const channel = useModerationChannel();
  const canRead = useCan(canReadCommentSettings, { channel });
  const settings = useQuery({ ...commentSettingsQueryOptions(api), enabled: canRead });

  return canRead ? settings.data?.disclosure : undefined;
}
