import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { authorize } from '../authorize';
import { ADMIN } from './entities';

const context = { action: 'create', subject: 'Category' };

describe('@vp/domain-rules: authorize', () => {
  it('returns the actor when the permission holds', () => {
    const result = authorize(ADMIN, true, context);

    expect(isOk(result) && result.value).toBe(ADMIN);
  });

  it('reports a missing identity as UNAUTHORIZED, not FORBIDDEN', () => {
    const result = authorize(null, true, context);

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('reports a signed-in caller without the permission as FORBIDDEN', () => {
    const result = authorize(ADMIN, false, context);

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('names the actor on a FORBIDDEN so an operator can trace it, and never on the wire', () => {
    const result = authorize(ADMIN, false, context);

    expect(isErr(result) && 'userId' in result.error && result.error.userId).toBe(ADMIN.id);
  });

  it('lets a caller supply the operator-facing wording', () => {
    const result = authorize(null, false, { ...context, message: 'Admin token required' });

    expect(isErr(result) && result.error.message).toBe('Admin token required');
  });
});
