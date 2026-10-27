import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';

/** The /live shell: its designed empty state until the live feature wires data. */
export function LivePage() {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="page">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h1>{tOr('live.emptyTitle', {}, '')}</h1>
      </EmptyState.Title>
      <EmptyState.Description>{tOr('live.emptyDescription', {}, '')}</EmptyState.Description>
      <EmptyState.Action asChild>
        <Link to="/">{tOr('live.browse', {}, '')}</Link>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}
