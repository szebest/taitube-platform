import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { renderToString } from 'react-dom/server';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Button } from '../../button';
import { ResponsiveModal } from '..';
import { COMPACT_QUERY } from '../responsive-modal';

const shareModal = (onOpenChange?: (open: boolean) => void) => (
  <ResponsiveModal.Root open onOpenChange={onOpenChange}>
    <ResponsiveModal.Content>
      <ResponsiveModal.Title>Share video</ResponsiveModal.Title>
      <ResponsiveModal.Description>Anyone with the link</ResponsiveModal.Description>
      <ResponsiveModal.Body>Lisbon at night</ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button>Done</Button>
        </ResponsiveModal.Close>
      </ResponsiveModal.Footer>
    </ResponsiveModal.Content>
  </ResponsiveModal.Root>
);

const viewport = (compact: boolean) => (query: string) =>
  ({
    media: query,
    matches: compact && query === COMPACT_QUERY,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList;

const stubViewport = (compact: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(viewport(compact));

const renderShareModal = (onOpenChange?: (open: boolean) => void) =>
  render(shareModal(onOpenChange), { wrapper: WithUiCopy });

describe('@vp/ui: ResponsiveModal', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = () => undefined;
  });

  it.each([
    { viewport: 'medium and up', compact: false, slot: 'dialog-content' },
    { viewport: 'compact', compact: true, slot: 'drawer-content' },
  ])('renders the same parts as a $slot on a $viewport viewport', ({ compact, slot }) => {
    stubViewport(compact);

    renderShareModal();

    const modal = screen.getByRole('dialog', { name: 'Share video' });
    expect(modal).toHaveAttribute('data-slot', slot);
    expect(modal).toHaveAccessibleDescription('Anyone with the link');
    expect(screen.getByText('Lisbon at night')).toBeInTheDocument();
  });

  it('stays open across the breakpoint', () => {
    const matchMedia = stubViewport(false);
    const { rerender } = renderShareModal();

    matchMedia.mockImplementation(viewport(true));
    rerender(shareModal());

    expect(screen.getByRole('dialog', { name: 'Share video' })).toBeInTheDocument();
  });

  it.each([
    { how: 'Escape', act: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}') },
    {
      how: 'a close action',
      act: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Done' })),
    },
  ])('asks to close on $how', async ({ act }) => {
    const onOpenChange = vi.fn();
    renderShareModal(onOpenChange);

    await act(userEvent.setup());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the open modal in place on the server, where a portal has no container', () => {
    const html = renderToString(<WithUiCopy>{shareModal()}</WithUiCopy>);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Share video');
  });

  it('passes axe open', async () => {
    renderShareModal();

    expect(await axeViolations()).toEqual([]);
  });
});
