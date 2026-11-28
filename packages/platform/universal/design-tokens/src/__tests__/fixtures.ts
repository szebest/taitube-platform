import { expectOk } from '@kit/testing/result';
import { defineAppearance, defineTheme, defineTokenSet } from '../define';
import { parseTheme } from '../parse';
import { themeFromTokens } from '../schema/__tests__/tokens-json';

export const { color, dataviz, defaults: parsed } = expectOk(parseTheme(themeFromTokens('sand')));

export const shadowSoft = defineTokenSet('shadow', 'soft', parsed.shadow.values);

export const shadowDeep = defineTokenSet('shadow', 'deep', parsed.shadow.values);

export const defaults = {
  typography: defineTokenSet('typography', 'figtree', parsed.typography.values),
  fontSize: defineTokenSet('fontSize', 'default', parsed.fontSize.values),
  spacing: defineTokenSet('spacing', 'default', parsed.spacing.values),
  sizing: defineTokenSet('sizing', 'medium', parsed.sizing.values),
  radius: defineTokenSet('radius', 'round', parsed.radius.values),
  border: defineTokenSet('border', 'hairline', parsed.border.values),
  shadow: shadowSoft,
  ambient: defineTokenSet('ambient', 'cinematic', parsed.ambient.values),
  motion: defineTokenSet('motion', 'standard', parsed.motion.values),
};

export const sand = defineTheme({ id: 'sand', name: 'Sand', color, dataviz, defaults });

export const deepSand = defineTheme({
  id: 'deep-sand',
  name: 'Deep sand',
  color,
  dataviz,
  defaults: { ...defaults, shadow: shadowDeep },
});

export const offer = {
  typography: [defaults.typography],
  fontSize: [defaults.fontSize],
  spacing: [defaults.spacing],
  sizing: [defaults.sizing],
  radius: [defaults.radius],
  border: [defaults.border],
  shadow: [shadowSoft],
  ambient: [defaults.ambient],
  motion: [defaults.motion],
} as const;

export const appearance = defineAppearance({ themes: [sand], defaultTheme: sand, offer });
