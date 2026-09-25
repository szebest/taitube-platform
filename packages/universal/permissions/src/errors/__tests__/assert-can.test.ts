import { type ErrorCode, ErrorCodes, PermanentError } from '@vp/errors';
import { standardUser } from '../../__mocks__/fixtures';
import { type AssertCanOptions, assertCan } from '../assert-can';

function refusal(options: AssertCanOptions): PermanentError {
  try {
    assertCan(false, options);
  } catch (error) {
    if (error instanceof PermanentError) return error;
    throw error;
  }
  throw new Error('assertCan let a refused action through');
}

describe('assertCan', () => {
  it('lets an allowed action through', () => {
    expect(() =>
      assertCan(true, { action: 'video:update', subject: 'Video', user: standardUser })
    ).not.toThrow();
  });

  it.each<{
    scenario: string;
    options: AssertCanOptions;
    code: ErrorCode;
    message: string;
    details: Record<string, string>;
  }>([
    {
      scenario: 'an anonymous caller with UNAUTHORIZED',
      options: { action: 'video:update', subject: 'Video', user: null },
      code: ErrorCodes.UNAUTHORIZED,
      message: "Authentication required to perform action 'video:update' on 'Video'",
      details: { action: 'video:update', subject: 'Video' },
    },
    {
      scenario: 'a signed-in caller with FORBIDDEN',
      options: { action: 'video:delete', subject: 'Video', user: standardUser },
      code: ErrorCodes.FORBIDDEN,
      message:
        "Forbidden: user 'usr-1' with role 'USER' cannot perform action 'video:delete' on 'Video'",
      details: { action: 'video:delete', subject: 'Video', userId: 'usr-1', userRole: 'USER' },
    },
    {
      scenario: 'the message the caller passes',
      options: {
        action: 'video:delete',
        subject: 'Video',
        user: standardUser,
        message: 'Custom forbidden message',
      },
      code: ErrorCodes.FORBIDDEN,
      message: 'Custom forbidden message',
      details: { action: 'video:delete', subject: 'Video', userId: 'usr-1', userRole: 'USER' },
    },
  ])('refuses $scenario', ({ options, code, message, details }) => {
    const error = refusal(options);

    expect(error.code).toBe(code);
    expect(error.message).toBe(message);
    expect(error.details).toEqual(details);
  });
});
