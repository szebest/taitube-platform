import { Spinner } from '@vp/ui';

/** The page a route shows while its loader runs, once the router's pending delay has passed. */
export function RoutePending() {
  return (
    <div className="flex justify-center py-12">
      <Spinner size="lg" />
    </div>
  );
}
