import { expectOk } from '@vp/testing/result';
import { parseTheme, parseTokenSet } from '../../parse';
import {
  refFromTokens,
  scaleFromTokens,
  THEME_NAMES,
  themeFromTokens,
  tokenSetValues,
  tokensWithoutDescriptions,
} from '../../schema/__tests__/tokens-json';
import { RefSchema } from '../../schema/ref';
import { ScaleSchema } from '../../schema/scale';
import type { TokenGroup } from '../../schema/token-group';
import { toDtcg } from '../dtcg';

const offered = <G extends TokenGroup>(group: G) =>
  Object.entries(tokenSetValues(group)).map(([id, values]) =>
    expectOk(parseTokenSet(group, { group, id, values }))
  );

const definitionsFromTokens = () => ({
  ref: RefSchema.parse(refFromTokens()),
  scale: ScaleSchema.parse(scaleFromTokens()),
  themes: THEME_NAMES.map((name) => expectOk(parseTheme(themeFromTokens(name)))),
  offer: {
    typography: offered('typography'),
    fontSize: offered('fontSize'),
    spacing: offered('spacing'),
    sizing: offered('sizing'),
    radius: offered('radius'),
    border: offered('border'),
    shadow: offered('shadow'),
    ambient: offered('ambient'),
    motion: offered('motion'),
  },
});

describe('toDtcg', () => {
  it('writes tokens.json back, key for key, from the definitions parsed out of it', () => {
    expect(JSON.stringify(toDtcg(definitionsFromTokens()), null, 2)).toBe(
      JSON.stringify(tokensWithoutDescriptions(), null, 2)
    );
  });
});
