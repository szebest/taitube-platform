import { fieldError } from '../field-error';

describe('apps/client/web: fieldError', () => {
  it.each([
    {
      field: 'an untouched field with an error',
      touched: false,
      errors: ['Too long'],
      shown: undefined,
    },
    {
      field: 'a touched field with an error',
      touched: true,
      errors: ['Too long'],
      shown: 'Too long',
    },
    { field: 'a touched valid field', touched: true, errors: [], shown: undefined },
  ])('shows $shown for $field', ({ touched, errors, shown }) => {
    expect(fieldError({ isTouched: touched, errors })).toBe(shown);
  });
});
