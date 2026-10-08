import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ToastProvider } from '#app/components/ui/toast';
import { TooltipProvider } from '#app/components/ui/tooltip';

/** Renders a showcase section inside the providers the root mounts for every page. */
export function renderSection(section: ReactElement) {
  return render(
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss">{section}</ToastProvider>
    </TooltipProvider>
  );
}
