import { type ErrorCodeSet, defineErrorCodes } from '../../registry';

defineErrorCodes({
  codes: { A: 'A', B: 'B' },
  // @ts-expect-error a code without a retry class does not compile
  retryClass: { A: 'permanent' },
  internal: 'A',
});

defineErrorCodes({
  codes: { A: 'A' },
  retryClass: { A: 'permanent' },
  // @ts-expect-error the internal code is one of the set
  internal: 'B',
});

const set = defineErrorCodes({
  codes: { A: 'A', B: 'B' },
  retryClass: { A: 'permanent', B: 'transient' },
  internal: 'A',
});

expectTypeOf(set).toEqualTypeOf<ErrorCodeSet<'A' | 'B'>>();
expectTypeOf(set.codes.A).toEqualTypeOf<'A'>();

defineErrorCodes({
  // @ts-expect-error a code maps to its own name
  codes: { A: 'B' },
  retryClass: { A: 'permanent' },
  internal: 'A',
});

defineErrorCodes({
  codes: { A: 'A' },
  // @ts-expect-error a retry class is permanent or transient
  retryClass: { A: 'flaky' },
  internal: 'A',
});
