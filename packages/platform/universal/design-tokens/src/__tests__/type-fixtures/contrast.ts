import { type ContrastFailure, type ContrastPair, checkContrast } from '../../contrast';

type Named = ContrastPair & { readonly name: string };

declare const pairs: readonly Named[];

expectTypeOf(checkContrast(pairs)).toEqualTypeOf<ContrastFailure<Named>[]>();
expectTypeOf(checkContrast(pairs)[0]?.name).toEqualTypeOf<string | undefined>();
expectTypeOf(checkContrast(pairs)[0]?.ratio).toEqualTypeOf<number | undefined>();

// @ts-expect-error a pair names its floor
checkContrast([{ foreground: '#000000', background: '#ffffff' }]);
