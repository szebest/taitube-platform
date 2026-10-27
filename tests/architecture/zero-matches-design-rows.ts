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

/** A `tw:` class with any variants before it, up to the utility. */
const UTILITY = String.raw`(?<![\w-])tw:(?:[^\s:'"\x60]+:)*-?`;

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
    fires: "'tw:h-[calc(100dvh-var(--spacing-header))]'",
  },
  {
    name: 'a Tailwind palette class, which the generated theme wipes, so it draws nothing',
    pattern: new RegExp(
      `${UTILITY}(?:bg|text|border(?:-[xytblrse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow)-(?:black|white|(?:${PALETTE})-\\d{2,3})\\b`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires: '<span className="tw:hover:bg-stone-900 tw:text-white" />',
  },
  {
    name: 'a utility from a Tailwind default scale the generated theme wipes (radius, shadow, blur, easing, tracking, leading, perspective, text size, font weight, container width, screen), so it draws nothing',
    pattern: new RegExp(
      `${UTILITY}(?:rounded(?:-(?:s|e|t|b|ss|se|es|ee))?-(?:md|lg|xl|[2-4]xl)|(?:inset-|drop-|text-)?shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner)|(?:backdrop-)?blur-(?:xs|sm|md|lg|xl|2xl|3xl)|ease-(?:in|out|in-out)|tracking-(?:tighter|tight|normal|wide|wider|widest)|leading-(?:tight|snug|normal|relaxed|loose)|perspective-(?:dramatic|near|normal|midrange|distant)|text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|(?:max-|min-)?w-(?:[23]xs|xs|sm|md|lg|xl|[2-7]xl))(?![\\w-])|(?<![\\w-])tw:(?:[^\\s:'"\\x60]+:)*(?:sm|md|lg|xl|2xl):`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires:
      '<div className="tw:rounded-lg tw:shadow-lg tw:medium:ease-in-out tw:text-sm tw:font-bold tw:max-w-sm tw:sm:p-4" />',
  },
  {
    name: 'a physical-side utility or inline style, where the logical one (ms-, pe-, start-, text-start, marginInlineStart) needs nothing for RTL',
    pattern: new RegExp(
      `${UTILITY}(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-(?:[lr]|[tb][lr])|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right)|scroll-[mp][lr])(?![\\w])|\\b(?:margin|padding|border|scrollMargin|scrollPadding)(?:Left|Right)\\b`,
      'g'
    ),
    scope: CLIENT_SOURCE,
    expected: 0,
    fires: '<nav className="tw:ml-auto tw:md:rounded-tl-card" style={{ paddingRight: 4 }} />',
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
