import { type RenderResult, render } from '@testing-library/react';
import { UiCopyProvider, uiCopyFrom } from '@vp/ui';
import type { ReactElement } from 'react';

const COPY = uiCopyFrom((key) => key);

/** Renders under the words every kit part reads, each word being its own key. */
export function renderWithCopy(ui: ReactElement): RenderResult {
  return render(<UiCopyProvider copy={COPY}>{ui}</UiCopyProvider>);
}
