import { CommonErrorCodes, PermanentError } from '@kit/errors';

export interface Actor {
  readonly id: string;
  readonly role: string;
}

export interface AssertCanOptions {
  readonly action: string;
  readonly subject: string;
  readonly user: Actor | null;
  readonly message?: string;
}

export function assertCan(allowed: boolean, options: AssertCanOptions): asserts allowed {
  if (!allowed) {
    const { action, subject, user, message } = options;

    if (!user) {
      throw new PermanentError(
        CommonErrorCodes.UNAUTHORIZED,
        message ?? `Authentication required to perform action '${action}' on '${subject}'`,
        {
          action,
          subject,
        }
      );
    }

    throw new PermanentError(
      CommonErrorCodes.FORBIDDEN,
      message ??
        `Forbidden: user '${user.id}' with role '${user.role}' cannot perform action '${action}' on '${subject}'`,
      {
        action,
        subject,
        userId: user.id,
        userRole: user.role,
      }
    );
  }
}
