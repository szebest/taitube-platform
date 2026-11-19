import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useFormat } from '../use-format';
import { SpecIntl } from './spec-intl';

function renderUseFormat(withProvider = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SpecIntl locale="de" timeZone="Europe/Berlin">
      {children}
    </SpecIntl>
  );
  return renderHook(useFormat, withProvider ? { wrapper } : undefined);
}

describe('@kit/intl-react: useFormat', () => {
  it('formats in the provider locale and zone', () => {
    const { format } = renderUseFormat().result.current;

    expect(format({ type: 'time', value: '2026-09-22T18:30:00.000Z' })).toEqual({
      ok: true,
      value: '20:30',
    });
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderUseFormat(false)).toThrow('useFormat must be called inside <IntlProvider>');
  });
});
