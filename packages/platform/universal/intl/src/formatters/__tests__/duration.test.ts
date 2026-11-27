import { ARABIC_INDIC_DIGIT, contextFor, format, formatText } from '../../__tests__/fixtures';
import { type DurationValue } from '../duration';

function render(locale: string, value: number, options?: DurationValue['options']) {
  const rendered = format({ type: 'duration', value, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

function withoutNativeDurationFormat<T>(run: () => T): T {
  const native = Reflect.get(Intl, 'DurationFormat');
  Reflect.deleteProperty(Intl, 'DurationFormat');
  try {
    return run();
  } finally {
    Reflect.set(Intl, 'DurationFormat', native);
  }
}

const cases = [
  { locale: 'en', value: 765, options: undefined, expected: '12:45' },
  { locale: 'en', value: 3753, options: undefined, expected: '1:02:33' },
  { locale: 'en', value: 5, options: undefined, expected: '00:05' },
  { locale: 'fi', value: 3753, options: undefined, expected: '1.02.33' },
  { locale: 'en', value: 3720, options: { style: 'words' } as const, expected: '1 hr, 2 min' },
  { locale: 'en', value: 0, options: { style: 'words' } as const, expected: '0 sec' },
  {
    locale: 'en',
    value: 3753,
    options: { style: 'words', unitDisplay: 'long' } as const,
    expected: '1 hour, 2 minutes, 33 seconds',
  },
  { locale: 'de', value: 3720, options: { style: 'words' } as const, expected: '1 Std., 2 Min.' },
];

describe('@kit/intl: duration', () => {
  it.each(cases)(
    'renders $value seconds in $locale as $expected',
    ({ locale, value, options, expected }) => {
      expect(render(locale, value, options)).toBe(expected);
    }
  );

  it.each(cases)(
    'renders $value seconds in $locale identically without Intl.DurationFormat',
    ({ locale, value, options, expected }) => {
      expect(withoutNativeDurationFormat(() => render(locale, value, options))).toBe(expected);
    }
  );

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', 765)).toMatch(ARABIC_INDIC_DIGIT);
  });

  it.each([-1, Number.NaN])('declines %d seconds', (value) => {
    expect(render('en', value)).toBe('FORMAT_UNRENDERABLE');
  });

  it.each([
    {
      value: 3_753_000,
      options: { unit: 'milliseconds', style: 'words' },
      expected: '1 hr, 2 min, 33 sec',
    },
    { value: 3753, options: { style: 'words', maxUnits: 2 }, expected: '1 hr, 2 min' },
    { value: 3753, options: { style: 'words', maxUnits: 1 }, expected: '1 hr' },
    { value: 600, options: { style: 'words', maxUnits: 1 }, expected: '10 min' },
    { value: 765, options: { hoursDisplay: 'always' }, expected: '0:12:45' },
    { value: 765, options: { maxUnits: 0, style: 'words' }, expected: 'FORMAT_UNRENDERABLE' },
  ] as const)('takes $options for $value', ({ value, options, expected }) => {
    expect(formatText({ type: 'duration', value, options })).toBe(expected);
  });
});
