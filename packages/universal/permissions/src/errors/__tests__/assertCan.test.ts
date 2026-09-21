import { ErrorCodes, PermanentError } from '@vp/errors';
import { describe, expect, it } from 'vitest';
import { standardUser } from '../../__mocks__/fixtures';
import { assertCan } from '../assert-can';

describe('errors/assertCan: RFC 9457 Permission Guard', () => {
  it('does nothing when allowed is true', () => {
    expect(() =>
      assertCan(true, {
        action: 'video:update',
        subject: 'Video',
        user: standardUser,
      })
    ).not.toThrow();
  });

  it('throws 401 UNAUTHORIZED when allowed is false and user is null (anonymous)', () => {
    expect(() =>
      assertCan(false, {
        action: 'video:update',
        subject: 'Video',
        user: null,
      })
    ).toThrowError(PermanentError);

    try {
      assertCan(false, {
        action: 'video:update',
        subject: 'Video',
        user: null,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PermanentError);
      const error = err as PermanentError;
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(error.message).toContain("Authentication required to perform action 'video:update'");
      expect(error.details).toEqual({ action: 'video:update', subject: 'Video' });
    }
  });

  it('throws 403 FORBIDDEN when allowed is false and user is authenticated', () => {
    expect(() =>
      assertCan(false, {
        action: 'video:delete',
        subject: 'Video',
        user: standardUser,
      })
    ).toThrowError(PermanentError);

    try {
      assertCan(false, {
        action: 'video:delete',
        subject: 'Video',
        user: standardUser,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PermanentError);
      const error = err as PermanentError;
      expect(error.code).toBe(ErrorCodes.FORBIDDEN);
      expect(error.message).toContain(
        "Forbidden: user 'usr-1' with role 'USER' cannot perform action 'video:delete'"
      );
      expect(error.details).toEqual({
        action: 'video:delete',
        subject: 'Video',
        userId: 'usr-1',
        userRole: 'USER',
      });
    }
  });

  it('respects custom message when provided', () => {
    try {
      assertCan(false, {
        action: 'video:delete',
        subject: 'Video',
        user: standardUser,
        message: 'Custom forbidden message',
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PermanentError);
      const error = err as PermanentError;
      expect(error.message).toBe('Custom forbidden message');
    }
  });
});
