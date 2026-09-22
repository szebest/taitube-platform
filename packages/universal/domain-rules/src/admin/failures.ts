import { ErrorCodes, type Failure } from '@vp/errors';

export type AdminAccessDenied = Failure<
  typeof ErrorCodes.FORBIDDEN,
  { authenticated: boolean }
>;

export type AdminUnauthorized = Failure<typeof ErrorCodes.UNAUTHORIZED, Record<never, never>>;

export type AdminAccessFailure = AdminAccessDenied | AdminUnauthorized;

export function adminUnauthorized(): AdminUnauthorized {
  return {
    code: ErrorCodes.UNAUTHORIZED,
    message:
      'Authentication required: provide an admin Bearer token or valid x-admin-token header',
  };
}

export function adminAccessDenied(): AdminAccessDenied {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Admin role required to access this resource',
    authenticated: true,
  };
}
