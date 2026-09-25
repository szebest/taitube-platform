import { Link } from '@tanstack/react-router';

import { LoadingSpinner } from 'src/modules/shared/components';

export function RoutePending() {
  return <LoadingSpinner />;
}

export function RouteError() {
  return <div role="alert">There was an error while loading the page</div>;
}

export function RouteNotFound() {
  return (
    <div role="alert">
      <p>This page does not exist.</p>
      <Link to="/">Go to the home page</Link>
    </div>
  );
}
