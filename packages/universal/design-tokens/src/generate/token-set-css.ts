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

const fontStack = (families: readonly string[]) =>
  families.map((family) => (family.includes(' ') ? `"${family}"` : family)).join(', ');

const WRITERS: { readonly [G in TokenGroup]: Writer<G> } = {
  typography: {
    kind: 'shared',
    declare: ({ font, weight, tracking }) => [
      ...Object.entries(font).map(([role, families]) => ({
        property: `--font-${role}`,
        value: fontStack(families),
      })),
      ...declare(weight, (style) => `--type-${style}-weight`),
      ...declare(tracking, (style) => `--type-${style}-tracking`),
    ],
  },
  fontSize: {
    kind: 'shared',
    declare: (styles) =>
      Object.entries(styles).flatMap(([style, { size, lineHeight }]) => [
        { property: `--type-${style}-size`, value: size },
        { property: `--type-${style}-line`, value: String(lineHeight) },
      ]),
  },
  spacing: { kind: 'shared', declare: (roles) => declare(roles, (role) => `--${role}`) },
  sizing: {
    kind: 'shared',
    declare: ({ control, icon, avatar, layout }) => [
      ...declare(control, (size) => `--size-control-${size}`),
      ...declare(icon, (size) => `--size-icon-${size}`),
      ...declare(avatar, (size) => `--size-avatar-${size}`),
      ...declare(layout, (measure) => `--layout-${measure}`),
    ],
  },
  radius: { kind: 'shared', declare: (roles) => declare(roles, (role) => `--r-${role}`) },
  border: { kind: 'shared', declare: (roles) => declare(roles, (role) => `--border-${role}`) },
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
      })),
  },
  ambient: {
    kind: 'per-family',
    declare: (ambient, family) => [
      { property: '--ambient', value: String(ambient[`opacity-${family}`]) },
      { property: '--ambient-blur', value: ambient.blur },
    ],
  },
  motion: {
    kind: 'shared',
    declare: ({ duration, easing }) => [
      ...declare(duration, (name) => `--duration-${name}`),
      ...Object.entries(easing).map(([name, points]) => ({
        property: `--ease-${name}`,
        value: `cubic-bezier(${points.join(', ')})`,
      })),
    ],
  },
};

export const tokenSetCss = <G extends TokenGroup>({ group, id, values }: TokenSet<G>) => {
  const selector = attribute(tokenGroups[group].path, id);
  const writer: Writer<G> = WRITERS[group];
  switch (writer.kind) {
    case 'shared':
      return stylesheet([rule(selector, writer.declare(values))]);
    case 'per-family':
      return stylesheet(
        MODE_FAMILIES.map((family) =>
          rule(`${selector}${inFamily(family)}`, writer.declare(values, family))
        )
      );
    default:
      return assertNever(writer, 'writer.kind');
  }
};
