import { render } from '@testing-library/react';
import { ThemeProvider, ToastProvider, TooltipProvider, createToaster } from '@vp/ui';
import type { ReactElement } from 'react';

/** Renders a showcase section inside the providers the root mounts for every page. */
export function renderSection(section: ReactElement) {
  return render(
    <ThemeProvider preference="system">
      <TooltipProvider>
        <ToastProvider toaster={createToaster()} closeLabel="Dismiss">
          {section}
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
