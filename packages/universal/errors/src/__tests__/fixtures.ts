import { defineErrorCodes } from '../registry';

export const codes = defineErrorCodes({
  codes: { NOT_FOUND: 'NOT_FOUND', DOWN: 'DOWN', INTERNAL: 'INTERNAL' },
  retryClass: { NOT_FOUND: 'permanent', DOWN: 'transient', INTERNAL: 'transient' },
  internal: 'INTERNAL',
});
