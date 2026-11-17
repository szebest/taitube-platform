import { useT } from '@kit/intl-react';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';

/** What the analytics show for a range nobody has watched anything in: the words in place of a screen of zeros. */
export function AnalyticsEmpty() {
  const { tOr } = useT();

  return (
    <EmptyState.Root>
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h2>{tOr('studio.analyticsEmptyTitle', {}, '')}</h2>
      </EmptyState.Title>
      <EmptyState.Description>
        {tOr('studio.analyticsEmptyDescription', {}, '')}
      </EmptyState.Description>
    </EmptyState.Root>
  );
}
