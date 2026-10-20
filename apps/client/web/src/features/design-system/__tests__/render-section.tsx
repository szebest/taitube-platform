import { render } from '@testing-library/react';
import { AppWords } from '@vp/queries';
import {
  AppearanceProvider,
  DEFAULT_APPEARANCE,
  ToastProvider,
  TooltipProvider,
  createToaster,
} from '@vp/ui';
import type { ReactElement } from 'react';

/** Renders a showcase section inside the providers the root mounts for every page. */
export function renderSection(section: ReactElement) {
  return render(
    <AppWords>
      <AppearanceProvider stored={{ preference: DEFAULT_APPEARANCE, source: 'none' }}>
        <TooltipProvider>
          <ToastProvider toaster={createToaster()}>{section}</ToastProvider>
        </TooltipProvider>
      </AppearanceProvider>
    </AppWords>
  );
}
