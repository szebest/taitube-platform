import { DATA_EXPORT_KINDS } from '@vp/domain';
import { canCreateChannelExport } from '@vp/permissions';
import { usePermissions } from '@vp/permissions-react';
import { useActiveChannel } from '#app/hooks/use-active-channel';

/** The kinds the viewer's role lets them export from the acting channel; none hides the exports. */
export function useExportableKinds() {
  const { userContext } = usePermissions();
  const { channelId, ownerId } = useActiveChannel();

  return DATA_EXPORT_KINDS.filter((kind) =>
    canCreateChannelExport({ user: userContext, channelExport: { channelId, ownerId, kind } })
  );
}
