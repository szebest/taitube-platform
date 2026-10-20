import { assertNever } from '@vp/result';
import { ELEVATION_OPTIONS } from '../schema/shadow';
import {
  type TokenGroup,
  type TokenSet,
  type TokenValues,
  tokenGroups,
} from '../schema/token-group';
import { MODE_FAMILIES, type ModeFamily } from '../schema/values';
import { attribute, type Declaration, declare, inFamily, rule, stylesheet } from './rule';

type Writer<G extends TokenGroup> =
  | Readonly<{ kind: 'shared'; declare: (values: TokenValues<G>) => Declaration[] }>
  | Readonly<{
      kind: 'per-family';
      declare: (values: TokenValues<G>, family: ModeFamily) => Declaration[];
    }>;

// A quoted keyword names a font called "serif", so the generic families stay bare.
const FONT_KEYWORDS: ReadonlySet<string> = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
]);

const fontStack = (families: readonly string[]) =>
  families.map((family) => (FONT_KEYWORDS.has(family) ? family : `"${family}"`)).join(', ');

const GAP_PREFIX = 'gap-';

const spacingUtility = (role: string) =>
  `--spacing-${role.startsWith(GAP_PREFIX) ? role.slice(GAP_PREFIX.length) : role}`;

const WRITERS: { readonly [G in TokenGroup]: Writer<G> } = {
  typography: {
    kind: 'shared',
    declare: ({ font, weight, tracking }) => [
      ...Object.entries(font).map(([role, families]) => ({
        property: `--font-${role}`,
        value: fontStack(families),
        utility: `--font-${role}`,
      })),
      ...declare(weight, (style) => ({
        property: `--type-${style}-weight`,
        utility: `--text-${style}--font-weight`,
      })),
      ...declare(tracking, (style) => ({
        property: `--type-${style}-tracking`,
        utility: `--text-${style}--letter-spacing`,
      })),
    ],
  },
  fontSize: {
    kind: 'shared',
    declare: (styles) =>
      Object.entries(styles).flatMap(([style, { size, lineHeight }]) => [
        { property: `--type-${style}-size`, value: size, utility: `--text-${style}` },
        {
          property: `--type-${style}-line`,
          value: String(lineHeight),
          utility: `--text-${style}--line-height`,
        },
      ]),
  },
  spacing: {
    kind: 'shared',
    declare: (roles) =>
      declare(roles, (role) => ({ property: `--${role}`, utility: spacingUtility(role) })),
  },
  sizing: {
    kind: 'shared',
    declare: ({ layout, ...sizes }) => [
      ...Object.entries(sizes).flatMap(([family, steps]) =>
        declare(steps, (size) => ({
          property: `--size-${family}-${size}`,
          utility: `--spacing-${family}-${size}`,
        }))
      ),
      ...declare(layout, (measure) => ({
        property: `--layout-${measure}`,
        utility: `--spacing-${measure}`,
      })),
    ],
  },
  radius: {
    kind: 'shared',
    declare: (roles) =>
      declare(roles, (role) => ({ property: `--r-${role}`, utility: `--radius-${role}` })),
  },
  border: {
    kind: 'shared',
    declare: (widths) => [
      { property: '--border-divider', value: widths.divider, utility: '--border-width-divider' },
      { property: '--border-control', value: widths.control, utility: '--border-width-control' },
      { property: '--border-focus', value: widths.focus, utility: '--outline-width-focus' },
      {
        property: '--border-focus-offset',
        value: widths['focus-offset'],
        utility: '--outline-offset-focus',
      },
    ],
  },
  shadow: {
    kind: 'per-family',
    declare: (steps, family) =>
      ELEVATION_OPTIONS.map((step) => ({
        property: `--shadow-${step}`,
        value: steps[`${family}-${step}`]
          .map(({ offsetX, offsetY, blur, spread, color }) =>
            [offsetX, offsetY, blur, spread, color].join(' ')
          )
          .join(', '),
        utility: `--shadow-${step}`,
      })),
  },
  ambient: {
    kind: 'per-family',
    declare: (ambient, family) => [
      {
        property: '--ambient',
        value: String(ambient[`opacity-${family}`]),
        utility: '--opacity-ambient',
      },
      { property: '--ambient-blur', value: ambient.blur, utility: '--blur-ambient' },
    ],
  },
  motion: {
    kind: 'shared',
    declare: ({ duration, easing }) => [
      ...declare(duration, (name) => ({
        property: `--duration-${name}`,
        utility: `--transition-duration-${name}`,
      })),
      ...Object.entries(easing).map(([name, points]) => ({
        property: `--ease-${name}`,
        value: `cubic-bezier(${points.join(', ')})`,
        utility: `--ease-${name}`,
      })),
    ],
  },
};

const declarationsIn = <G extends TokenGroup>(
  { group, values }: TokenSet<G>,
  families: readonly ModeFamily[]
) => {
  const writer: Writer<G> = WRITERS[group];
  switch (writer.kind) {
    case 'shared':
      return [{ scope: '', declarations: writer.declare(values) }];
    case 'per-family':
      return families.map((family) => ({
        scope: inFamily(family),
        declarations: writer.declare(values, family),
      }));
    default:
      return assertNever(writer, 'writer.kind');
  }
};

export const tokenSetCss = <G extends TokenGroup>(set: TokenSet<G>) =>
  stylesheet(
    declarationsIn(set, MODE_FAMILIES).map(({ scope, declarations }) =>
      rule(`${attribute(tokenGroups[set.group].path, set.id)}${scope}`, declarations)
    )
  );

// A per-family set names the same variables in every family, so one family lists them all.
export const tokenSetDeclarations = <G extends TokenGroup>(set: TokenSet<G>) =>
  declarationsIn(set, ['dark']).flatMap(({ declarations }) => declarations);
