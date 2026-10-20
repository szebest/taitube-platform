import { render, screen } from '@testing-library/react';
import { FIXTURE_UI_COPY } from '../../__tests__/ui-copy-fixture';
import { type UiCopy, UiCopyProvider, useUiCopy } from '../ui-copy';

function CloseWord() {
  return <span>{useUiCopy().close}</span>;
}

const renderCloseWord = (copy?: UiCopy) =>
  render(
    copy === undefined ? (
      <CloseWord />
    ) : (
      <UiCopyProvider copy={copy}>
        <CloseWord />
      </UiCopyProvider>
    )
  );

describe('@vp/ui: UiCopyProvider', () => {
  it('hands its words to the primitives under it, and new words on a locale change', () => {
    const { rerender } = renderCloseWord(FIXTURE_UI_COPY);
    rerender(
      <UiCopyProvider copy={{ ...FIXTURE_UI_COPY, close: 'Stäng' }}>
        <CloseWord />
      </UiCopyProvider>
    );

    expect(screen.getByText('Stäng')).toBeInTheDocument();
  });

  it('throws for a primitive mounted without one, so a missing mount fails a spec', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderCloseWord()).toThrow('useUiCopy must be used within UiCopyProvider');
  });
});
