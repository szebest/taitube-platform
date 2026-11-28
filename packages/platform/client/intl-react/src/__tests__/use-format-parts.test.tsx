import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useFormatParts } from '../use-format-parts';
import { SpecIntl } from './spec-intl';

function renderUseFormatParts(withProvider = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SpecIntl locale="en" timeZone="UTC">
      {children}
    </SpecIntl>
  );
  return renderHook(useFormatParts, withProvider ? { wrapper } : undefined);
}

describe('@kit/intl-react: useFormatParts', () => {
  it('returns the structure of a list in the provider locale', () => {
    const formatParts = renderUseFormatParts().result.current;

    expect(
      formatParts({
        type: 'list',
        value: ['A', 'B', 'C'],
        options: { max: 1, more: { other: '{?} more' } },
      })
    ).toMatchObject({
      ok: true,
      value: { visible: ['A'], hidden: ['B', 'C'], total: 3, text: 'A and 2 more' },
    });
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderUseFormatParts(false)).toThrow(
      'useFormatParts must be called inside <IntlProvider>'
    );
  });
});
