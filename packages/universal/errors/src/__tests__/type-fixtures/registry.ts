import { defineErrorCodes } from '../../registry';

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
