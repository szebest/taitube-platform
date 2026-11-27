import { useToast } from '@kit/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { DataExportKind } from '@vp/domain';
import { useUserEvent } from '@vp/queries';
import { developerKeys } from '#app/features/developers/api/developer-queries';
import { useT } from '#app/lib/messages';

/** Reloads the exports when the job settles one, and says which. */
export function useExportEvents() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { tOr } = useT();
  const kindOf = (kind: DataExportKind) => tOr('studio.exportKind', { kind }, kind);

  useUserEvent('export.ready', ({ payload }) => {
    void queryClient.invalidateQueries({ queryKey: developerKeys.exports() });
    toast({
      tone: 'success',
      title: tOr('studio.exportsReady', { kind: kindOf(payload.kind) }, ''),
    });
  });

  useUserEvent('export.failed', ({ payload }) => {
    void queryClient.invalidateQueries({ queryKey: developerKeys.exports() });
    toast({
      tone: 'danger',
      title: tOr('studio.exportsFailedEvent', { kind: kindOf(payload.kind) }, ''),
    });
  });
}
