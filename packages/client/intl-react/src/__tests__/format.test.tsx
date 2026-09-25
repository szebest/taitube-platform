import { render } from '@testing-library/react';
import type { FormatValue } from '@vp/intl';
import { Format } from '../format';
import { IntlProvider } from '../intl-provider';

function rendered(value: FormatValue, fallback?: string): string | null {
  const { container } = render(
    <IntlProvider locale="en" timeZone="UTC">
      <Format value={value} fallback={fallback} />
    </IntlProvider>
  );
  return container.textContent;
}

describe('@vp/intl-react: Format', () => {
  it.each([
    { value: { type: 'count', value: 12_345 } as const, expected: '12K' },
    { value: { type: 'duration', value: 765 } as const, expected: '12:45' },
    { value: 'as authored', expected: 'as authored' },
  ])('renders $value', ({ value, expected }) => {
    expect(rendered(value)).toBe(expected);
  });

  it.each([
    { fallback: undefined, expected: '' },
    { fallback: '-', expected: '-' },
  ])('renders the fallback $fallback for a value it cannot format', ({ fallback, expected }) => {
    expect(rendered({ type: 'date', value: 'yesterday' }, fallback)).toBe(expected);
  });
});
