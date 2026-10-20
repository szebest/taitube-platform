import tokens from '../../../../../../docs/design/tokens.json' with { type: 'json' };
import { TOKEN_GROUPS, type TokenGroup } from '../token-group';

export function isRecord(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

function withoutMetadata(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(withoutMetadata);
  }

  if (!isRecord(node)) {
    return node;
  }

  if (Object.hasOwn(node, '$value')) {
    return withoutMetadata(node.$value);
  }

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, child]) => [key, withoutMetadata(child)])
  );
}

const asRecord = (node: unknown): Record<string, unknown> => (isRecord(node) ? node : {});

const recordsIn = (node: unknown): Record<string, Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(asRecord(withoutMetadata(node))).map(([key, child]) => [key, asRecord(child)])
  );

export const tokenSetValues = (group: TokenGroup) => recordsIn(tokens.set[group]);

export const refFromTokens = () => asRecord(withoutMetadata(tokens.ref));

export const scaleFromTokens = () => recordsIn(tokens.scale);

export type ThemeName = keyof typeof tokens.theme;

export const THEME_NAMES: readonly ThemeName[] = ['sand', 'nocturne'];

export function themeFromTokens(name: ThemeName) {
  const { defaults, dark, light, oled, dataviz } = tokens.theme[name];
  const defaultIds = asRecord(withoutMetadata(defaults));
  return {
    id: name,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    color: {
      dark: asRecord(withoutMetadata(dark)),
      light: asRecord(withoutMetadata(light)),
      oled: asRecord(withoutMetadata(oled)),
    },
    dataviz: asRecord(withoutMetadata(dataviz)),
    defaults: Object.fromEntries(
      TOKEN_GROUPS.map((group) => {
        const id = String(defaultIds[group]);
        return [group, { group, id, values: tokenSetValues(group)[id] }];
      })
    ),
  };
}

function withoutDescriptions(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(withoutDescriptions);
  }

  if (!isRecord(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== '$description')
      .map(([key, child]) => [key, withoutDescriptions(child)])
  );
}

export const tokensWithoutDescriptions = () => withoutDescriptions(tokens);
