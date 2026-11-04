import { Spinner } from '@vp/ui';

export function RoutePending() {
  return (
    <div className="tw:flex tw:justify-center tw:py-12">
      <Spinner size="lg" />
    </div>
  );
}
