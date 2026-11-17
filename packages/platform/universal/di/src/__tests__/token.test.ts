import { token } from '../token';

describe('@kit/di: token', () => {
  it('carries its name for messages', () => {
    expect(token<number>('Port').name).toBe('Port');
  });
});
