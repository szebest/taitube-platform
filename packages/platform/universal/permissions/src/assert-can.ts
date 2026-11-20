import { PermanentError } from '@kit/errors';

export const PermissionErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export interface Actor {
  readonly id: string;
  readonly role: string;
}

export interface AssertCanOptions {
  action: string;
  subject: string;
  user: Actor | null;
  message?: string;
}

export function assertCan(allowed: boolean, options: AssertCanOptions): asserts allowed {
  if (!allowed) {
    const { action, subject, user, message } = options;

    if (!user) {
      throw new PermanentError(
        PermissionErrorCodes.UNAUTHORIZED,
        message ?? `Authentication required to perform action '${action}' on '${subject}'`,
        {
          action,
          subject,
        }
      );
    }

    throw new PermanentError(
      PermissionErrorCodes.FORBIDDEN,
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
