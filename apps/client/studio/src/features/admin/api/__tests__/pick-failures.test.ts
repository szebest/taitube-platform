import { ApiError } from '@vp/api-client';
import { problemDetails } from '@vp/api-contracts';

import { pickFailureOf } from '../pick-failures';

const problem = (code: string, status: number, errors?: unknown[]) =>
  problemDetails({ code, status, title: code, detail: code, instance: 'x', errors });

const refused = (code: string, status: number, errors?: unknown[]) =>
  new ApiError(status, code, code, problem(code, status, errors));

describe('apps/client/studio: pickFailureOf', () => {
  it.each([
    {
      name: 'a window clash',
      cause: refused('PICK_WINDOW_OVERLAP', 409),
      failure: { kind: 'overlap' },
    },
    {
      name: 'a refused field',
      cause: refused('VALIDATION_FAILED', 422, [{ field: 'note' }]),
      failure: { kind: 'field', field: 'note' },
    },
    {
      name: 'a field the form has not',
      cause: refused('VALIDATION_FAILED', 422, [{ field: 'other' }]),
      failure: { kind: 'other' },
    },
    {
      name: 'a refusal naming nothing',
      cause: refused('FORBIDDEN', 403),
      failure: { kind: 'other' },
    },
    { name: 'a network failure', cause: new TypeError('offline'), failure: { kind: 'other' } },
  ])('reads $name', ({ cause, failure }) => {
    expect(pickFailureOf(cause)).toEqual(failure);
  });
});
