import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { decideUploadAccess } from '../upload-access.rule';

const OWNER: UserContext = { id: 'u-owner', role: 'USER' };
const STRANGER: UserContext = { id: 'u-other', role: 'USER' };
const ADMIN: UserContext = { id: 'u-admin', role: 'ADMIN' };

const upload = { id: 'up-1', ownerId: OWNER.id };

describe('@vp/domain-rules: decideUploadAccess', () => {
  it.each([
    { actor: 'the owner', user: OWNER },
    { actor: 'an admin', user: ADMIN },
  ])('hands the upload back to $actor', ({ user }) => {
    expect(
      decideUploadAccess({ actor: user, upload, uploadId: upload.id, action: 'abort this upload' })
    ).toEqual({ ok: true, value: upload });
  });

  it.each([
    { scenario: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const decided = decideUploadAccess({
      actor,
      upload,
      uploadId: upload.id,
      action: 'abort this upload',
    });

    expect(decided.ok).toBe(false);
    expect(decided.ok === false && decided.error.code).toBe(code);
  });

  it.each([
    { scenario: 'a stranger', actor: STRANGER },
    { scenario: 'an admin', actor: ADMIN },
  ])('reports an unknown upload id to $scenario alike', ({ actor }) => {
    const missing = decideUploadAccess({
      actor,
      upload: null,
      uploadId: 'up-unknown',
      action: 'view this upload',
    });

    expect(missing.ok === false && missing.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('carries the action into the refusal message', () => {
    const refused = decideUploadAccess({
      actor: STRANGER,
      upload,
      uploadId: upload.id,
      action: 'complete this upload',
    });

    expect(refused.ok === false && refused.error.message).toContain('complete this upload');
  });
});
