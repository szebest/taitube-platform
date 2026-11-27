import {
  choice,
  defineSection,
  deviceBackend,
  flag,
  sectionDefaults,
  text,
  tokenOverrides,
} from '../define';

const SECTION = defineSection({
  size: choice({ options: ['s', 'm', 'l'], default: 'm', scope: 'both' }),
  muted: flag({ default: true, scope: 'device' }),
  name: text({ kind: 'preferenceId', scope: 'account' }),
  tokens: tokenOverrides({ scope: 'both' }),
  paint: flag({ default: false, scope: 'both', device: 'cookie' }),
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

  it.each([
    { setting: 'a device field naming a backend', key: 'paint', expected: 'cookie' },
    { setting: 'a device field naming none', key: 'size', expected: 'storage' },
    { setting: 'an account-only field', key: 'name', expected: undefined },
  ] as const)('puts $setting on $expected', ({ key, expected }) => {
    expect(deviceBackend(SECTION[key])).toBe(expected);
  });
});
