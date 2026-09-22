import { ErrorCodes, type Failure } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';

export type Unauthorized = Failure<
  typeof ErrorCodes.UNAUTHORIZED,
  { action: string; subject: string }
>;

export type Forbidden = Failure<
  typeof ErrorCodes.FORBIDDEN,
  { action: string; subject: string; userId: string }
>;

export type AuthorizationFailure = Unauthorized | Forbidden;

export interface AuthorizationContext {
  readonly action: string;
  readonly subject: string;
  readonly message?: string;
}

/**
 * The `Result` form of the old `assertCan`: not signed in is `UNAUTHORIZED`, signed in without the
 * permission is `FORBIDDEN`. One owner for that distinction, because every resource needs it and a
 * rule that collapses the two turns a missing token into a 403 the caller cannot act on.
 */
export function authorize(
  actor: UserContext | null,
  allowed: boolean,
  context: AuthorizationContext
): Result<UserContext, AuthorizationFailure> {
  const { action, subject, message } = context;

  if (!actor) {
    return err({
      code: ErrorCodes.UNAUTHORIZED,
      message: message ?? `Authentication required to perform action '${action}' on '${subject}'`,
      action,
      subject,
    });
  }

  if (!allowed) {
    return err({
      code: ErrorCodes.FORBIDDEN,
      message:
        message ??
        `Forbidden: user '${actor.id}' with role '${actor.role}' cannot perform action '${action}' on '${subject}'`,
      action,
      subject,
      userId: actor.id,
    });
  }

  return ok(actor);
}
