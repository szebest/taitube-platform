import { ErrorCodes } from '@vp/errors';
import { invalidField } from '../field-failures';

describe('@vp/validation: the app field failures', () => {
  it('reject under VALIDATION_FAILED', () => {
    expect(invalidField('slug', 'bad slug', {}).code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
