import { ErrorCodes, RETRY_CLASS } from '@vp/errors';
import { ERROR_COPY } from '@vp/messages';
import { present } from '../present-failure';

describe('@vp/queries: present', () => {
  it.each([
    { code: ErrorCodes.VIDEO_NOT_FOUND, kind: 'not-found' },
    { code: ErrorCodes.ROUTE_NOT_FOUND, kind: 'not-found' },
    { code: ErrorCodes.FORBIDDEN, kind: 'forbidden' },
    { code: ErrorCodes.UNAUTHORIZED, kind: 'unauthorised' },
    { code: ErrorCodes.RATE_LIMITED, kind: 'rate-limited' },
    { code: ErrorCodes.DATABASE_UNAVAILABLE, kind: 'server' },
    { code: ErrorCodes.INTERNAL, kind: 'server' },
    { code: ErrorCodes.VALIDATION_FAILED, kind: 'generic' },
  ])('shows $code as a $kind failure', ({ code, kind }) => {
    expect(present({ code }).kind).toBe(kind);
  });

  it.each(Object.entries(RETRY_CLASS))(
    'presents %s with its copy and retry class',
    (code, retryClass) => {
      const presented = present({ code: code as keyof typeof ERROR_COPY });

      expect(presented.copy).toBe(ERROR_COPY[code as keyof typeof ERROR_COPY]);
      expect(presented.retryable).toBe(retryClass === 'transient');
    }
  );
});
