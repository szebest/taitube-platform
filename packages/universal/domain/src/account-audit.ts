/** A user's own log of their account, read at `GET /v1/me/security/sign-ins`; no address is kept. */
export type AccountAuditAction = 'account.signed_in';

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
