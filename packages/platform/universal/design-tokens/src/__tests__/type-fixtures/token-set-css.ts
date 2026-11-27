import { tokenSetCss } from '../../generate/token-set-css';
import type { TokenSet } from '../../schema/token-group';

declare const radius: TokenSet<'radius', 'soft'>;
declare const spacing: TokenSet<'spacing'>;

expectTypeOf(tokenSetCss(radius)).toEqualTypeOf<string>();
expectTypeOf(tokenSetCss(spacing)).toEqualTypeOf<string>();

// @ts-expect-error a set, not its bare values
tokenSetCss(radius.values);
