import { defineParams } from '../params';

describe('@kit/i18n: defineParams', () => {
  it('returns the names as a frozen list', () => {
    const names = defineParams(['count', 'userName'] as const);

    expect(names).toEqual(['count', 'userName']);
    expect(Object.isFrozen(names)).toBe(true);
  });
});
