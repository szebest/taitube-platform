import type { ModeOption } from '../schema/theme';
import type { ModeFamily } from '../schema/values';

export type Declaration = Readonly<{ property: string; value: string; utility?: string }>;

type Names = Pick<Declaration, 'property' | 'utility'>;

const FAMILY_MODES: Readonly<Record<ModeFamily, readonly Exclude<ModeOption, 'system'>[]>> = {
  dark: ['dark', 'oled'],
  light: ['light'],
};

export const declare = (
  values: Readonly<Record<string, string | number>>,
  names: (key: string) => Names
): Declaration[] =>
  Object.entries(values).map(([key, value]) => ({ ...names(key), value: String(value) }));

export const utilities = (declarations: readonly Declaration[]): Declaration[] =>
  declarations.flatMap(({ property, utility }) =>
    utility === undefined ? [] : [{ property: utility, value: `var(${property})` }]
  );

export const attribute = (name: string, value: string) => `[data-${name}="${value}"]`;

export const inFamily = (family: ModeFamily) =>
  `:is(${FAMILY_MODES[family].map((mode) => attribute('mode', mode)).join(', ')})`;

export const rule = (selector: string, declarations: readonly Declaration[]) =>
  declarations.length === 0
    ? ''
    : [
        `${selector} {`,
        ...declarations.map(({ property, value }) => `  ${property}: ${value};`),
        '}',
      ].join('\n');

export const stylesheet = (rules: readonly string[]) =>
  `${rules.filter((written) => written !== '').join('\n\n')}\n`;
