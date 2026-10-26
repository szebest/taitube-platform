import { Link, useRouter } from '@tanstack/react-router';
import { ErrorState } from '@vp/components';

import { LoadingSpinner } from '#app/modules/shared/components';

export function RoutePending() {
  return <LoadingSpinner />;
}

export function RouteError() {
  const router = useRouter();

  const handleRetry = () => {
    void router.invalidate();
  };

  return (
    <ErrorState.Root kind="generic" onRetry={handleRetry}>
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>There was an error while loading the page</h1>
      </ErrorState.Title>
      <ErrorState.Retry />
      <ErrorState.Action asChild>
        <Link to="/">Go to the home page</Link>
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
        <Link to="/">Go to the home page</Link>
      </ErrorState.Action>
    </ErrorState.Root>
  );
}
