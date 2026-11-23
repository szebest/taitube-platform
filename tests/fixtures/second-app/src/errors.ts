import { CommonErrorCodes, defineErrorCodes } from '@kit/errors';

export const ShopErrorCodes = defineErrorCodes({
  codes: { ...CommonErrorCodes, SHELF_FULL: 'SHELF_FULL', BOOK_NOT_FOUND: 'BOOK_NOT_FOUND' },
  retryClass: {
    VALIDATION_FAILED: 'permanent',
    INTERNAL: 'transient',
    UNAUTHORIZED: 'permanent',
    FORBIDDEN: 'permanent',
    SHELF_FULL: 'transient',
    BOOK_NOT_FOUND: 'permanent',
  },
  internal: CommonErrorCodes.INTERNAL,
});
