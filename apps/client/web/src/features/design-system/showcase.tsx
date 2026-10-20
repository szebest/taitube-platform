import { Display } from './display';
import { FormControls } from './form-controls';
import { Overlays } from './overlays';

/**
 * Every primitive in `@vp/ui` in every variant, size and state, once per mode. Overlays
 * open in the document's mode: switch it in the header to see them in the other one.
 */
const MODES = ['dark', 'light'] as const;

export function Showcase() {
  return (
    <div className="tw:grid tw:gap-6 tw:p-4 tw:font-sans tw:lg:grid-cols-2">
      <h1 className="tw:m-0 tw:text-2xl tw:font-medium tw:lg:col-span-2">Design system</h1>
      {MODES.map((mode) => (
        <div
          key={mode}
          data-mode={mode}
          className="tw:flex tw:flex-col tw:gap-8 tw:rounded-xl tw:border tw:border-border tw:bg-bg tw:p-6 tw:text-fg"
        >
          <p className="tw:m-0 tw:text-sm tw:text-fg-muted">{`${mode} mode`}</p>
          <FormControls />
          <Display />
          <Overlays />
        </div>
      ))}
    </div>
  );
}
