import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ThemeProvider } from '#app/components/ui/theme/theme-provider';
import { ToastProvider } from '#app/components/ui/toast';
import { TooltipProvider } from '#app/components/ui/tooltip';

/** Renders a showcase section inside the providers the root mounts for every page. */
export function renderSection(section: ReactElement) {
  return render(
    <ThemeProvider preference="system">
      <TooltipProvider>
        <ToastProvider closeLabel="Dismiss">{section}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
