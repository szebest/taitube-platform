import { PageHeader } from '@kit/components';
import { useExportableKinds } from '#app/features/developers/hooks/use-exportable-kinds';
import { useT } from '#app/lib/messages';
import { ApiReferenceSection } from '../api-reference-section/api-reference-section';
import { ExportsSection } from '../exports-section/exports-section';
import { TokensSection } from '../tokens-section/tokens-section';
import { WebhooksSection } from '../webhooks-section/webhooks-section';

/** What a creator's own scripts need: tokens, webhooks, the channel's data and the API reference. */
export function DevelopersPage() {
  const { tOr } = useT();
  const kinds = useExportableKinds();

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.developersTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>
          {tOr('studio.developersDescription', {}, '')}
        </PageHeader.Description>
      </PageHeader.Root>
      <TokensSection />
      <WebhooksSection />
      {kinds.length > 0 && <ExportsSection kinds={kinds} />}
      <ApiReferenceSection />
    </div>
  );
}
