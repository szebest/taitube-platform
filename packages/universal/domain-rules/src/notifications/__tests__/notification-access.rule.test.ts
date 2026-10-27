import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, OWNER, STRANGER } from '../../__tests__/entities';
import {
  decideNotificationAccess,
  type NotificationAccessInput,
} from '../notification-access.rule';

const GUEST: UserContext = { id: 'guest-1', role: 'GUEST' };
const ACTIONS: NotificationAccessInput['action'][] = ['read', 'update'];

describe('@vp/domain-rules: decideNotificationAccess', () => {
  it.each(
    ACTIONS.flatMap((action) => [
      { scenario: 'the owner', actor: OWNER, action },
      { scenario: 'an admin', actor: ADMIN, action },
    ])
  )('lets $scenario $action', ({ actor, action }) => {
    expect(expectOk(decideNotificationAccess({ actor, ownerId: OWNER.id, action }))).toBe(actor);
  });

  it.each(
    ACTIONS.flatMap((action) => [
      {
        scenario: 'a signed-in stranger',
        actor: STRANGER,
        ownerId: OWNER.id,
        action,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'a guest-role caller on their own',
        actor: GUEST,
        ownerId: GUEST.id,
        action,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'an anonymous caller',
        actor: null,
        ownerId: OWNER.id,
        action,
        code: ErrorCodes.UNAUTHORIZED,
      },
    ])
  )('refuses $scenario $action with $code', ({ actor, ownerId, action, code }) => {
    expect(expectErr(decideNotificationAccess({ actor, ownerId, action })).code).toBe(code);
  });
});
