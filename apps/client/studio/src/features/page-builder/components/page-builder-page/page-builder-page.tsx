import { EmptyState, PageHeader } from '@kit/components';
import { useQuery } from '@tanstack/react-query';
import { canUpdateChannel } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { pageDraftQueryOptions } from '#app/features/page-builder/api/page-queries';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { PageBuilder } from '../page-builder/page-builder';

/** `/customization/page`: build the channel's tabs and sections, then publish, schedule or restore them. */
export function PageBuilderPage() {
  const { tOr } = useT();
  const { channelId, ownerId } = useActiveChannel();
  const draft = useQuery(pageDraftQueryOptions(useApi(), channelId));

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.pageTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>{tOr('studio.pageDescription', {}, '')}</PageHeader.Description>
      </PageHeader.Root>
      <Can
        type="rule"
        I={canUpdateChannel}
        this={{ channel: { id: channelId, userId: ownerId, ownerId } }}
        fallback={
          <EmptyState.Root>
            <EmptyState.Title>{tOr('studio.pageForbidden', {}, '')}</EmptyState.Title>
          </EmptyState.Root>
        }
      >
        {draft.data && <PageBuilder key={channelId} draft={draft.data} />}
      </Can>
    </div>
  );
}
