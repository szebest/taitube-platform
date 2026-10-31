import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, STRANGER, aPick } from '../../__tests__/entities';
import { decidePickDelete } from '../delete-pick.rule';

const pick = aPick();

describe('@vp/domain-rules: decidePickDelete', () => {
  it('hands an admin the pick to remove', () => {
    expect(expectOk(decidePickDelete({ actor: ADMIN, pick, pickId: pick.id }))).toBe(pick);
  });

  it.each([
    { name: 'an anonymous caller', actor: null, found: pick, code: ErrorCodes.UNAUTHORIZED },
    {
      name: 'a caller without the ability',
      actor: STRANGER,
      found: pick,
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'an absent pick', actor: ADMIN, found: null, code: ErrorCodes.PICK_NOT_FOUND },
    {
      name: 'a stranger asking after an absent pick',
      actor: STRANGER,
      found: null,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $name with $code', ({ actor, found, code }) => {
    expect(expectErr(decidePickDelete({ actor, pick: found, pickId: 'pick-1' })).code).toBe(code);
  });
});
