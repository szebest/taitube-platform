import { InfraErrorCodes } from '../infra-codes';

describe('@kit/errors: the infra codes', () => {
  it.each(Object.entries(InfraErrorCodes))(
    '%s names itself, as a code set requires',
    (key, code) => {
      expect(code).toBe(key);
    }
  );
});
