import { scaleCss } from '../scale-css';
import { fixtureScale, lines } from './fixture';

describe('scaleCss', () => {
  it('writes the raw space scale, the z layers and the layout measures on the root', () => {
    expect(scaleCss(fixtureScale)).toBe(
      lines(
        ':root {',
        '  --space-0: 0px;',
        '  --space-1: 4px;',
        '  --space-2: 8px;',
        '  --space-3: 12px;',
        '  --space-4: 16px;',
        '  --space-5: 20px;',
        '  --space-6: 24px;',
        '  --space-8: 32px;',
        '  --space-10: 40px;',
        '  --space-12: 48px;',
        '  --space-16: 64px;',
        '  --space-20: 80px;',
        '  --space-24: 96px;',
        '  --z-behind: -2;',
        '  --z-ambient: -1;',
        '  --z-base: 0;',
        '  --z-lift: 1;',
        '  --z-stage-tap: 2;',
        '  --z-stage-hud: 3;',
        '  --z-stage-controls: 4;',
        '  --z-stage-actions: 5;',
        '  --z-sticky: 10;',
        '  --z-header: 15;',
        '  --z-rail: 20;',
        '  --z-pip: 25;',
        '  --z-overlay: 30;',
        '  --z-modal: 40;',
        '  --z-popover: 50;',
        '  --z-toast: 60;',
        '  --z-tooltip: 70;',
        '  --layout-content-max: 2000px;',
        '  --layout-reading-max: 64ch;',
        '}'
      )
    );
  });
});
