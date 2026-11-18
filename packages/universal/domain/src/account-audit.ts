/** A user's own log of their account, read at `GET /v1/me/security/sign-ins`; no address is kept. */
export type AccountAuditAction = 'account.signed_in';

export const ACCOUNT_AUDIT_USER_AGENT_MAX_LENGTH = 200;

export interface AccountAuditMeta {
  slot: number | null;
  userAgent: string | null;
}

export interface NewAccountAuditEntry {
  userId: string;
  action: AccountAuditAction;
  meta: AccountAuditMeta;
}

export interface AccountAuditEntry extends NewAccountAuditEntry {
  id: string;
  createdAt: Date;
}

/** Cut to the stored length, so a header of any size is one bounded row. */
export function accountAuditMeta(
  slot: number | null,
  userAgent: string | undefined
): AccountAuditMeta {
  return {
    slot,
    userAgent: userAgent ? userAgent.slice(0, ACCOUNT_AUDIT_USER_AGENT_MAX_LENGTH) : null,
  };
}
