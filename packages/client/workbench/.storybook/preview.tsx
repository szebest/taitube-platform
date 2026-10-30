import type { Preview } from '@storybook/react-vite';
import { withAppearance } from '../src/decorator';
import { loadLatinFonts } from '../src/fonts';
import { appearanceToolbars, initialAppearanceGlobals } from '../src/toolbars';
import './preview.css';

const preview: Preview = {
  globalTypes: appearanceToolbars,
  initialGlobals: initialAppearanceGlobals,
  decorators: [withAppearance],
  loaders: [() => loadLatinFonts()],
  parameters: { a11y: { test: 'error' } },
};

export default preview;
