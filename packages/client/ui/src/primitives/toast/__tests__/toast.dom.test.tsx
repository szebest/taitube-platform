import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Toast as ToastPrimitive } from 'radix-ui';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Button } from '../../button';
import { Toast } from '..';
import type { ToastTone } from '../types';

const renderToast = (tone?: ToastTone, onClose: () => void = () => undefined) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <ToastPrimitive.Provider>
        <Toast.Root tone={tone} defaultOpen onOpenChange={(open) => !open && onClose()}>
          <Toast.Icon />
          <Toast.Title>Could not save</Toast.Title>
          <Toast.Description>Check your connection.</Toast.Description>
          <Toast.Action altText="Retry saving" asChild>
            <Button size="sm">Retry</Button>
          </Toast.Action>
          <Toast.Close />
        </Toast.Root>
        <ToastPrimitive.Viewport />
      </ToastPrimitive.Provider>,
      { wrapper: WithUiCopy }
    ),
  };
};

describe('@vp/ui: Toast', () => {
  it.each([
    { tone: 'neutral', glyph: 'info' },
    { tone: 'success', glyph: 'check' },
    { tone: 'warning', glyph: 'alert' },
    { tone: 'danger', glyph: 'alert' },
    { tone: 'info', glyph: 'info' },
  ] as const)('shows the $tone glyph beside its title and text', ({ tone, glyph }) => {
    renderToast(tone);

    const toast = screen.getByText('Could not save').closest('[data-slot="toast"]');
    expect(toast?.querySelector('[data-slot="toast-icon"]')).toHaveAttribute('data-icon', glyph);
    expect(toast).toHaveTextContent('Check your connection.');
  });

  it('closes from its named close button', async () => {
    const onClose = vi.fn();
    const { user } = renderToast('danger', onClose);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passes axe', async () => {
    renderToast('danger');

    expect(await axeViolations()).toEqual([]);
  });
});
