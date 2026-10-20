import { render, screen } from '@testing-library/react';
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
    const { rerender } = renderCloseWord({ close: 'Close', loading: 'Loading' });
    rerender(
      <UiCopyProvider copy={{ close: 'Stäng', loading: 'Laddar' }}>
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
