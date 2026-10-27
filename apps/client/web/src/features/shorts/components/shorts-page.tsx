import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';

/** The /shorts shell: its designed empty state until the shorts feature wires data. */
export function ShortsPage() {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="page">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h1>{tOr('shorts.emptyTitle', {}, '')}</h1>
      </EmptyState.Title>
      <EmptyState.Description>{tOr('shorts.emptyDescription', {}, '')}</EmptyState.Description>
      <EmptyState.Action asChild>
        <Link to="/">{tOr('shorts.browse', {}, '')}</Link>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}
