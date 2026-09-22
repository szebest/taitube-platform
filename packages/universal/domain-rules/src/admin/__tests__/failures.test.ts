import { ErrorCodes } from '@vp/errors';
import { adminAccessDenied, adminUnauthorized } from '../failures';

describe('@vp/domain-rules: admin access failures', () => {
  it('separates an anonymous caller from one without the role', () => {
    expect(adminUnauthorized().code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(adminAccessDenied().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('keeps the original operator-facing wording for an anonymous caller', () => {
    expect(adminUnauthorized().message).toContain('x-admin-token');
  });
});
