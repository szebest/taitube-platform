import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateFeaturedSelection } from '../selection';

describe('@vp/validation: validateFeaturedSelection', () => {
  it.each([
    { name: 'no videos', ids: [] },
    { name: 'one video', ids: ['a'] },
    { name: 'a full shelf', ids: ['a', 'b', 'c', 'd', 'e', 'f'] },
  ])('accepts $name in the order given', ({ ids }) => {
    expect(expectOk(validateFeaturedSelection(ids, 6))).toEqual(ids);
  });

  it.each([
    { name: 'a seventh video', ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], message: /at most 6/ },
    { name: 'a video twice', ids: ['a', 'b', 'a'], message: /once/ },
  ])('rejects $name', ({ ids, message }) => {
    const failure = expectErr(validateFeaturedSelection(ids, 6));

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'videoIds',
      max: 6,
    });
    expect(failure.message).toMatch(message);
  });
});
