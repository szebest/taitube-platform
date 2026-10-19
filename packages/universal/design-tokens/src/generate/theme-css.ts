import type { Theme } from '../schema/theme';
import { MODE_FAMILIES, type ModeFamily } from '../schema/values';
import { attribute, type Declaration, inFamily, rule, stylesheet } from './rule';

const roles = (colors: Theme['color']['oled']): Declaration[] =>
  Object.entries(colors).flatMap(([role, value]) =>
    value === undefined ? [] : [{ property: `--${role}`, value }]
  );

const palette = (name: string, colors: readonly string[]): Declaration[] =>
  colors.map((value, index) => ({ property: `--dataviz-${name}-${index + 1}`, value }));

export const themeCss = ({ id, color, dataviz }: Theme) => {
  const selector = attribute('theme', id);
  const family = (mode: ModeFamily) =>
    rule(`${selector}${inFamily(mode)}`, [
      ...roles(color[mode]),
      ...palette('categorical', dataviz[`categorical-${mode}`]),
    ]);
  return stylesheet([
    rule(selector, [
      ...palette('sequential', dataviz.sequential),
      ...palette('diverging', dataviz.diverging),
    ]),
    ...MODE_FAMILIES.map(family),
    rule(`${selector}${attribute('mode', 'oled')}`, roles(color.oled)),
  ]);
};
