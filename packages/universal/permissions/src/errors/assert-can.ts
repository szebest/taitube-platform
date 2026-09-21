import { ErrorCodes, PermanentError } from '@vp/errors';
import type { UserContext } from '../types/index.js';

export interface AssertCanOptions {
  action: string;
  subject: string;
  user: UserContext | null;
  message?: string;
}

export function assertCan(allowed: boolean, options: AssertCanOptions): asserts allowed {
  if (!allowed) {
    const { action, subject, user, message } = options;

    if (!user) {
      throw new PermanentError(
        ErrorCodes.UNAUTHORIZED,
        message ?? `Authentication required to perform action '${action}' on '${subject}'`,
        {
          action,
          subject,
        }
      );
    }

    throw new PermanentError(
      ErrorCodes.FORBIDDEN,
      message ??
        `Forbidden: user '${user.id}' with role '${user.role ?? 'GUEST'}' cannot perform action '${action}' on '${subject}'`,
      {
        action,
        subject,
        userId: user.id,
        userRole: user.role ?? 'GUEST',
      }
    );
  }
}
