import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { ErrorState } from '@vp/components';
import { Spinner } from '@vp/ui';

export function RoutePending() {
  return <Spinner size="lg" className="tw:mx-auto tw:my-8" />;
}

export function RouteError({ reset }: ErrorComponentProps) {
  return (
    <ErrorState.Root kind="generic" onRetry={reset}>
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>There was an error while loading the page</h1>
      </ErrorState.Title>
      <ErrorState.Retry />
      <ErrorState.Action asChild>
        <Link to="/">Go to the studio</Link>
      </ErrorState.Action>
    </ErrorState.Root>
  );
}

export function RouteNotFound() {
  return (
    <ErrorState.Root kind="not-found">
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>This page does not exist.</h1>
      </ErrorState.Title>
      <ErrorState.Action asChild>
        <Link to="/">Go to the studio</Link>
      </ErrorState.Action>
    </ErrorState.Root>
  );
}
