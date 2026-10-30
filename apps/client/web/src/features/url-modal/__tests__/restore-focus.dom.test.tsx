import { render, renderHook, screen } from '@testing-library/react';

import { rememberOpener, useRestoreFocusOnClose } from '../restore-focus';

describe('useRestoreFocusOnClose', () => {
  it('hands focus back to the remembered opener when the modal closes', () => {
    render(
      <>
        <h1>Page</h1>
        <button type="button">Opener</button>
      </>
    );
    screen.getByRole('button', { name: 'Opener' }).focus();
    rememberOpener();
    const { rerender } = renderHook(({ open }) => useRestoreFocusOnClose(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
  });

  it('focuses the page heading when nothing remembered opened it', () => {
    render(<h1>Page</h1>);
    document.body.focus();
    rememberOpener();
    const { rerender } = renderHook(({ open }) => useRestoreFocusOnClose(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(screen.getByRole('heading', { name: 'Page' })).toHaveFocus();
  });

  it('does not touch focus while the modal stays open', () => {
    render(<h1>Page</h1>);
    const { rerender } = renderHook(({ open }) => useRestoreFocusOnClose(open), {
      initialProps: { open: true },
    });

    rerender({ open: true });

    expect(screen.getByRole('heading', { name: 'Page' })).not.toHaveFocus();
  });
});
