import type { Theme } from '#app/components/ui/theme/theme-preference';
import { Display } from './display';
import { FormControls } from './form-controls';
import { Overlays } from './overlays';

const THEMES: readonly Theme[] = ['dark', 'light'];

/**
 * Every primitive in `components/ui/` in every variant, size and state, once per theme. Overlays
 * open in the document's theme: switch it in the header to see them in the other one.
 */
export function Showcase() {
  return (
    <div className="tw:grid tw:gap-6 tw:p-4 tw:font-sans tw:lg:grid-cols-2">
      <h1 className="tw:m-0 tw:text-2xl tw:font-medium tw:lg:col-span-2">Design system</h1>
      {THEMES.map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          className="tw:flex tw:flex-col tw:gap-8 tw:rounded-xl tw:border tw:border-border tw:bg-surface tw:p-6 tw:text-fg"
        >
          <p className="tw:m-0 tw:text-sm tw:text-fg-muted">{`${theme} theme`}</p>
          <FormControls />
          <Display />
          <Overlays />
        </div>
      ))}
    </div>
  );
}
