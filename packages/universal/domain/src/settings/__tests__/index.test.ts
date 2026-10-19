import { PREFERENCE_SECTIONS } from '../index';

const choices = Object.entries(PREFERENCE_SECTIONS).flatMap(([section, settings]) =>
  Object.entries(settings).flatMap(([key, setting]) =>
    setting.type === 'choice' ? [{ path: `${section}.${key}`, setting }] : []
  )
);

describe('domain/settings', () => {
  it.each(choices)('$path defaults to one of its options', ({ setting }) => {
    expect(setting.options).toContain(setting.default);
  });
});
