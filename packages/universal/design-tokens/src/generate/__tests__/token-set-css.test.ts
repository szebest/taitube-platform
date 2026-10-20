import type { TokenGroup } from '../../schema/token-group';
import { tokenSetCss } from '../token-set-css';
import { fixtureSets, lines } from './fixture';

const cssFor = (group: TokenGroup) => tokenSetCss(fixtureSets[group]);

describe('tokenSetCss', () => {
  it.each<[TokenGroup, string]>([
    [
      'typography',
      lines(
        '[data-typography="plain"] {',
        '  --font-sans: "Plain Sans", -apple-system, sans-serif;',
        '  --font-editorial: "Georgia", ui-serif, serif;',
        '  --font-mono: "SFMono-Regular", monospace;',
        '  --type-display-weight: 800;',
        '  --type-headline-weight: 750;',
        '  --type-title-lg-weight: 750;',
        '  --type-title-weight: 650;',
        '  --type-body-weight: 400;',
        '  --type-body-sm-weight: 400;',
        '  --type-label-weight: 650;',
        '  --type-caption-weight: 500;',
        '  --type-overline-weight: 750;',
        '  --type-editorial-weight: 420;',
        '  --type-mono-weight: 500;',
        '  --type-display-tracking: -0.02em;',
        '  --type-headline-tracking: -0.01em;',
        '  --type-title-lg-tracking: 0em;',
        '  --type-title-tracking: 0em;',
        '  --type-body-tracking: 0em;',
        '  --type-body-sm-tracking: 0em;',
        '  --type-label-tracking: 0em;',
        '  --type-caption-tracking: 0em;',
        '  --type-overline-tracking: 0.1em;',
        '  --type-editorial-tracking: 0em;',
        '  --type-mono-tracking: 0em;',
        '}'
      ),
    ],
    [
      'fontSize',
      lines(
        '[data-font-size="tiny"] {',
        '  --type-display-size: 40px;',
        '  --type-display-line: 1.1;',
        '  --type-headline-size: 30px;',
        '  --type-headline-line: 1.2;',
        '  --type-title-lg-size: 20px;',
        '  --type-title-lg-line: 1.25;',
        '  --type-title-size: 16px;',
        '  --type-title-line: 1.3;',
        '  --type-body-size: 14px;',
        '  --type-body-line: 1.5;',
        '  --type-body-sm-size: 12px;',
        '  --type-body-sm-line: 1.5;',
        '  --type-label-size: 13px;',
        '  --type-label-line: 1.2;',
        '  --type-caption-size: 11px;',
        '  --type-caption-line: 1.3;',
        '  --type-overline-size: 11px;',
        '  --type-overline-line: 1.2;',
        '  --type-editorial-size: 18px;',
        '  --type-editorial-line: 1.4;',
        '  --type-mono-size: 12px;',
        '  --type-mono-line: 1.3;',
        '}'
      ),
    ],
    [
      'spacing',
      lines(
        '[data-spacing="snug"] {',
        '  --inset-control: 10px;',
        '  --inset-card: 14px;',
        '  --gap-inline: 6px;',
        '  --gap-stack: 10px;',
        '  --gap-grid-x: 12px;',
        '  --gap-grid-y: 20px;',
        '  --gap-shelf: 10px;',
        '  --section: 24px;',
        '  --gutter-compact: 10px;',
        '  --gutter-medium: 14px;',
        '  --gutter-expanded: 20px;',
        '}'
      ),
    ],
    [
      'sizing',
      lines(
        '[data-sizing="snug"] {',
        '  --size-control-sm: 24px;',
        '  --size-control-md: 32px;',
        '  --size-control-lg: 40px;',
        '  --size-icon-sm: 12px;',
        '  --size-icon-md: 16px;',
        '  --size-icon-lg: 20px;',
        '  --size-avatar-xs: 16px;',
        '  --size-avatar-sm: 20px;',
        '  --size-avatar-md: 28px;',
        '  --size-avatar-lg: 36px;',
        '  --size-avatar-xl: 72px;',
        '  --layout-touch-target: 44px;',
        '  --layout-header: 52px;',
        '  --layout-rail-expanded: 220px;',
        '  --layout-rail-collapsed: 68px;',
        '  --layout-card-min: 220px;',
        '  --layout-row-thumb: 120px;',
        '}'
      ),
    ],
    [
      'radius',
      lines(
        '[data-radius="square"] {',
        '  --r-xs: 0px;',
        '  --r-sm: 1px;',
        '  --r-thumb: 2px;',
        '  --r-card: 3px;',
        '  --r-sheet: 4px;',
        '  --r-control: 5px;',
        '  --r-chip: 6px;',
        '}'
      ),
    ],
    [
      'border',
      lines(
        '[data-border="thin"] {',
        '  --border-divider: 1px;',
        '  --border-control: 1px;',
        '  --border-focus: 2px;',
        '  --border-focus-offset: 3px;',
        '}'
      ),
    ],
    [
      'shadow',
      lines(
        '[data-shadow="drop"]:is([data-mode="dark"], [data-mode="oled"]) {',
        '  --shadow-1: 0px 1px 2px 0px #00000066;',
        '  --shadow-2: 0px 2px 4px 0px #00000066, 0px 8px 16px 0px #00000033;',
        '  --shadow-3: 0px 4px 8px 0px #00000080;',
        '}',
        '',
        '[data-shadow="drop"]:is([data-mode="light"]) {',
        '  --shadow-1: 0px 1px 2px 0px #0000001A;',
        '  --shadow-2: 0px 2px 4px 0px #0000001A;',
        '  --shadow-3: 0px 4px 8px 0px #00000026;',
        '}'
      ),
    ],
    [
      'ambient',
      lines(
        '[data-ambient="glow"]:is([data-mode="dark"], [data-mode="oled"]) {',
        '  --ambient: 0.5;',
        '  --ambient-blur: 60px;',
        '}',
        '',
        '[data-ambient="glow"]:is([data-mode="light"]) {',
        '  --ambient: 0.2;',
        '  --ambient-blur: 60px;',
        '}'
      ),
    ],
    [
      'motion',
      lines(
        '[data-motion="brisk"] {',
        '  --duration-instant: 50ms;',
        '  --duration-fast: 100ms;',
        '  --duration-base: 200ms;',
        '  --duration-slow: 300ms;',
        '  --duration-cinematic: 500ms;',
        '  --ease-standard: cubic-bezier(0.2, 0, 0, 1);',
        '  --ease-enter: cubic-bezier(0, 0, 0.2, 1);',
        '  --ease-exit: cubic-bezier(0.4, 0, 1, 1);',
        '  --ease-settle: cubic-bezier(0.2, 0.8, 0.2, 1);',
        '}'
      ),
    ],
  ])('writes the %s set under its kebab attribute', (group, css) => {
    expect(cssFor(group)).toBe(css);
  });
});
