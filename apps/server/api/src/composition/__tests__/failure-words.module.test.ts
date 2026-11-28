import { Container } from '@kit/composition';
import { ErrorCodes } from '@vp/errors';
import { registerFailureWords } from '../failure-words.module';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: failure words module', () => {
  it('composes a translator per registered locale over the shared catalogues', () => {
    const words = registerFailureWords(new Container()).get(Services.FailureWords);
    const forbidden = { code: ErrorCodes.FORBIDDEN, message: 'Forbidden' };

    expect([words.detail(forbidden, ['en']), words.detail(forbidden, ['pl', 'en'])]).toEqual([
      'You are not allowed to do that.',
      'Nie masz uprawnień do tej czynności.',
    ]);
  });
});
