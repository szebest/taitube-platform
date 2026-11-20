import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useT } from '../use-t';
import { SpecIntl } from './spec-intl';

function renderUseT(withProvider = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SpecIntl locale="en" timeZone="UTC">
      {children}
    </SpecIntl>
  );
  return renderHook(useT, withProvider ? { wrapper } : undefined);
}

describe('@kit/intl-react: useT', () => {
  it('returns the translator the provider built over its locale', () => {
    const translator = renderUseT().result.current;

    expect([translator.locale, translator.count(12_345)]).toEqual(['en', '12K']);
  });

  it('fails loudly outside a provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderUseT(false)).toThrow('useT must be called inside <IntlProvider>');
  });
});
