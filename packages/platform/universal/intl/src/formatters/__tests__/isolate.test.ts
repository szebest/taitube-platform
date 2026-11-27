import { formatText } from '../../__tests__/fixtures';

describe('@kit/intl: isolate', () => {
  it.each(['en', 'ar'])('wraps the text in a first-strong isolate in %s', (locale) => {
    expect(formatText({ type: 'isolate', value: 'Ada' }, locale)).toBe('⁨Ada⁩');
  });
});
