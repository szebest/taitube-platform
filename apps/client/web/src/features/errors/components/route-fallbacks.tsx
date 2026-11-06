import { Spinner } from '@vp/ui';

export function RoutePending() {
  return (
    <div className="flex justify-center py-12">
      <Spinner size="lg" />
    </div>
  );
}
