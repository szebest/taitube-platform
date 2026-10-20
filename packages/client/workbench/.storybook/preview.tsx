import type { Preview } from '@storybook/react-vite';
import { withAppearance } from '../src/decorator';
import { appearanceToolbars, initialAppearanceGlobals } from '../src/toolbars';
import './preview.css';

const preview: Preview = {
  globalTypes: appearanceToolbars,
  initialGlobals: initialAppearanceGlobals,
  decorators: [withAppearance],
  parameters: { a11y: { test: 'error' } },
};

export default preview;
