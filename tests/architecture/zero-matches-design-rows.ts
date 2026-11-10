import type { Row } from './zero-matches-rows';

const NOT_SPECS = [
  ':(exclude,glob)**/*.test.ts',
  ':(exclude,glob)**/*.test.tsx',
  ':(exclude,glob)**/__tests__/**',
  ':(exclude,glob)**/__mocks__/**',
];

/** What the browser draws: every client app's and client package's source, specs aside. */
const CLIENT_SOURCE = [
  ':(glob)apps/client/*/src/**/*.ts',
  ':(glob)apps/client/*/src/**/*.tsx',
  ':(glob)packages/client/*/src/**/*.ts',
  ':(glob)packages/client/*/src/**/*.tsx',
  ...NOT_SPECS,
];

/** The stylesheets written by hand that outlive 62: `@vp/ui`'s own and the workbench preview's. */
const SYSTEM_STYLESHEETS = [
  ':(glob)packages/client/ui/src/styles/*.css',
  'packages/client/workbench/.storybook/preview.css',
];

/** A class token with any variants before it, up to the utility. */
const UTILITY = String.raw`(?<![\w.:/-])(?:[^\s:'"\x60]+:)*-?`;

const PALETTE = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'mauve',
  'olive',
  'mist',
  'taupe',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');

/** The rows that keep components on the design system's tokens and inside its packages. */
export const DESIGN_ROWS: readonly Row[] = [
  {
    name: 'a raw colour in client source, where a colour role belongs (media is not chrome: the stand-in posters stories paint, the ambient colour sampled from a video, and the workbench accents standing in for one a viewer types)',
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/g,
    scope: [
      ...CLIENT_SOURCE,
      'packages/client/workbench/.storybook/preview.css',
      ':(exclude,glob)packages/client/ui/src/tokens/**',
      ':(exclude,glob)packages/client/ui/src/themes/**',
      ':(exclude,glob)**/*.stories.tsx',
      ':(exclude)apps/client/web/src/hooks/use-ambient-sample.ts',
      ':(exclude)packages/client/workbench/src/toolbars.ts',
    ],
    expected: 0,
    fires: "{ name: 'theme-color', content: '#000000' },",
  },
  {
    name: 'a var() of a theme-only name: the generated theme is `inline reference`, so `--spacing-*` and its siblings never reach the page; name the set variable they map to',
    pattern:
      /var\(--(?:spacing|text|radius|shadow|color|z-index|breakpoint|container|font-weight)-[\w-]+\)/g,
    scope: [...CLIENT_SOURCE, ...SYSTEM_STYLESHEETS],
    expected: 0,
    fires: "'h-[calc(100dvh-var(--spacing-header))]'",
  },
  {
    name: 'a raw z-index (z-<n>, z-[<n>], -z-<n>, zIndex, z-index), where a role of scale.z belongs: z-behind to z-tooltip, one distinct number each',
    pattern: new RegExp(`${UTILITY}z-[\\d\\[(]|\\bzIndex\\b|(?<![\\w-])z-index\\s*:`, 'g'),
    scope: [...CLIENT_SOURCE, ...SYSTEM_STYLESHEETS],
    expected: 0,
    fires: '<div className="relative -z-10 md:z-[2] z-1" style={{ zIndex: 3 }} />',
    passes: '<div className="z-behind z-stage-hud group-data-open:z-modal" />',
  },
  {
    name: 'a literal duration or delay (duration-200, duration-[300ms]), where a duration token belongs: duration-instant to duration-cinematic, which the motion set (standard, calm, reduced) scales',
    pattern: new RegExp(`${UTILITY}(?:duration|delay)-(?:\\d|\\[\\d)`, 'g'),
    scope: [...CLIENT_SOURCE, ...SYSTEM_STYLESHEETS],
    expected: 0,
    fires: '<div className="transition-colors duration-200 md:delay-[150ms]" />',
    passes: '<div className="transition-colors duration-fast ease-standard" />',
  },
  {
    name: 'a transition of every property or of a layout one (transition-all, transition-[width], transition: height), where only transform, opacity, colour, shadow and the other compositor properties animate; the sliding indicator is absolutely positioned and resizes nothing around it',
    pattern: new RegExp(
      `${UTILITY}transition-(?:all\\b|\\[[^\\]]*\\b(?:all|width|height|inline-size|block-size|margin[\\w-]*|padding[\\w-]*|top|left|right|bottom|inset[\\w-]*|gap)\\b[^\\]]*\\])|\\btransition(?:-property)?:[^;{}]*\\b(?:all|width|height|inline-size|block-size|margin[\\w-]*|padding[\\w-]*)\\b`,
      'g'
    ),
    scope: [
      ...CLIENT_SOURCE,
      ...SYSTEM_STYLESHEETS,
      ':(exclude)packages/client/ui/src/lib/sliding-indicator.ts',
    ],
    expected: 0,
    fires:
      '<div className="transition-all transition-[width,opacity] hover:transition-[margin-inline-start]" /> a { transition: height 1s }',
    passes: '<div className="transition-[opacity,translate] transition-colors" />',
  },
  {
    name: 'data-theme set to a mode (dark, light, oled), which is not a theme id: a surface that must be dark sets data-mode="dark"',
    pattern: /data-theme=["'{]*(?:dark|light|oled)\b/g,
    scope: CLIENT_SOURCE,
    expected: 0,
    fires: '<Container data-theme="dark" className="bg-bg" />',
    passes: '<Container data-mode="dark" className="bg-media" />',
  },
  {
    name: 'a Tailwind palette class, which the generated theme wipes, so it draws nothing',
    pattern: new RegExp(
      `${UTILITY}(?:bg|text|border(?:-[xytblrse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow)-(?:black|white|(?:${PALETTE})-\\d{2,3})\\b`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires: '<span className="hover:bg-stone-900 text-white" />',
  },
  {
    name: 'a utility from a Tailwind default scale the generated theme wipes (radius, shadow, blur, easing, tracking, leading, perspective, text size, font weight, container width, screen), so it draws nothing',
    pattern: new RegExp(
      `${UTILITY}(?:rounded(?:-(?:s|e|t|b|ss|se|es|ee))?-(?:md|lg|xl|[2-4]xl)|(?:inset-|drop-|text-)?shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner)|(?:backdrop-)?blur-(?:xs|sm|md|lg|xl|2xl|3xl)|ease-(?:in|out|in-out)|tracking-(?:tighter|tight|normal|wide|wider|widest)|leading-(?:tight|snug|normal|relaxed|loose)|perspective-(?:dramatic|near|normal|midrange|distant)|text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|(?:max-|min-)?w-(?:[23]xs|xs|sm|md|lg|xl|[2-7]xl))(?![\\w-])|(?<![\\w.:/-])(?:[^\\s:'"\\x60]+:)*(?:sm|md|lg|xl|2xl):(?=[\\w\\[(-])`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires:
      '<div className="rounded-lg shadow-lg medium:ease-in-out text-sm font-bold max-w-sm sm:p-4" />',
  },
  {
    name: 'a physical-side utility or inline style, where the logical one (ms-, pe-, start-, text-start, marginInlineStart) needs nothing for RTL',
    pattern: new RegExp(
      `${UTILITY}(?:(?:m[lr]|p[lr]|left|right|scroll-[mp][lr])-(?:-?[\\d\\[(]|auto|px|full)|(?:border-[lr]|rounded-(?:[lr]|[tb][lr])|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right))(?![\\w]))|\\b(?:margin|padding|border|scrollMargin|scrollPadding)(?:Left|Right)\\b`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires:
      '<nav className="ml-auto pl-4 left-0 -ml-2 md:pr-3 right-1/2 md:rounded-tl-card" style={{ paddingRight: 4 }} />',
    passes: '// laid out right-to-left and left-aligned with ms-2 start-0 border-s',
  },
  {
    name: 'a physical-side property in a design-system stylesheet, where the logical one needs nothing for RTL',
    pattern:
      /\b(?:margin|padding|border|scroll-margin|scroll-padding)-(?:left|right)\b|(?<![\w-])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/g,
    scope: SYSTEM_STYLESHEETS,
    expected: 0,
    fires: '.rail { margin-left: 4px; text-align: left; }',
  },
  {
    name: 'Radix or @dnd-kit outside @vp/ui, imported or declared: every app and package reaches them through its primitives',
    pattern: /['"](?:radix-ui|@radix-ui\/[^'"]+|@dnd-kit\/[^'"]+)['"]/g,
    scope: [
      ':(glob)apps/**/*.ts',
      ':(glob)apps/**/*.tsx',
      ':(glob)apps/*/*/package.json',
      ':(glob)packages/**/*.ts',
      ':(glob)packages/**/*.tsx',
      ':(glob)packages/*/*/package.json',
      ':(exclude,glob)packages/client/ui/**',
    ],
    expected: 0,
    fires: "import { Slot } from 'radix-ui';",
  },
  {
    name: 'the design library (docs/design/lib/) reached from outside docs/, which only the stand-in screens read',
    pattern: /docs\/design\/lib\b/g,
    scope: [
      ':(glob)apps/**/*.ts',
      ':(glob)apps/**/*.tsx',
      ':(glob)apps/**/*.css',
      ':(glob)packages/**/*.ts',
      ':(glob)packages/**/*.tsx',
      ':(glob)packages/**/*.css',
      ':(glob)scripts/**/*.ts',
      ...NOT_SPECS,
    ],
    expected: 0,
    fires: "@import '../../../docs/design/lib/design.css';",
  },
  {
    name: 'a tt- class of the design library in client source',
    pattern: /(?<![\w-])tt-[a-z]/g,
    scope: [...CLIENT_SOURCE, ...SYSTEM_STYLESHEETS],
    expected: 0,
    fires: '<div className="tt-avatar tt-avatar--lg" />',
  },
];
