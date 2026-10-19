import { choice, defineSection, flag, sectionDefaults, text, tokenOverrides } from '../define';

const SECTION = defineSection({
  size: choice({ options: ['s', 'm', 'l'], default: 'm', scope: 'both' }),
  muted: flag({ default: true, scope: 'device' }),
  name: text({ kind: 'preferenceId', scope: 'account' }),
  tokens: tokenOverrides({ scope: 'both' }),
});

describe('domain/settings: define', () => {
  it.each([
    { setting: 'a choice', key: 'size', type: 'choice', fallback: 'm' },
    { setting: 'a flag', key: 'muted', type: 'flag', fallback: true },
    { setting: 'a free text', key: 'name', type: 'text', fallback: null },
    { setting: 'token overrides', key: 'tokens', type: 'tokenOverrides', fallback: {} },
  ] as const)('tags $setting and takes its default', ({ key, type, fallback }) => {
    expect(SECTION[key].type).toBe(type);
    expect(sectionDefaults(SECTION)[key]).toEqual(fallback);
  });
});
