import type { Account } from '@vp/api-contracts';
import { account, COMMENT_AUTHOR_ID, OWNER_ID } from '@vp/web-testing';

export { COMMENT_ID, comment } from '@vp/web-testing';

export const REPLY_ID = '0190c3a0-5e1d-7000-8000-00000000d002';
export const AUTHOR_ID = COMMENT_AUTHOR_ID;
export const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000b003';

/** A signed-in account with `id` and `role`; the default one is the video's owner. */
export function viewerAccount(id: string = OWNER_ID, role: Account['role'] = 'USER'): Account {
  const { user } = account();
  return account({ role, user: { ...user, id } });
}
