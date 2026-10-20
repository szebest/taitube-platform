import { Link } from '@tanstack/react-router';
import { Spinner } from '@vp/ui';

export function RoutePending() {
  return <Spinner size="lg" className="tw:mx-auto tw:my-8" />;
}

export function RouteError() {
  return <div role="alert">There was an error while loading the page</div>;
}

export function RouteNotFound() {
  return (
    <div role="alert">
      <p>This page does not exist.</p>
      <Link to="/">Go to the studio</Link>
    </div>
  );
}
