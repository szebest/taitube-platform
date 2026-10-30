import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { StudioWorkspace, StudioWorkspaceSkeleton } from '..';
import { renderWorkspace } from './workspace.fixture';

describe('apps/client/studio: StudioWorkspace', () => {
  it('puts the skip link first and lands it on the main landmark', () => {
    renderWorkspace();

    const skip = screen.getByRole('link', { name: 'Skip to content' });

    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(document.body.querySelector('a')).toBe(skip);
  });

  it.each([
    { width: 'large', layout: 'three-column' },
    { width: 'medium', layout: 'two-column' },
    { width: 'compact', layout: 'single' },
  ] as const)('lays itself out in $layout on a $width screen', ({ width, layout }) => {
    renderWorkspace(width);

    expect(document.querySelector('[data-slot="studio-workspace"]')).toHaveAttribute(
      'data-layout',
      layout
    );
  });

  it('opens the navigation drawer from the toolbar menu button on a compact screen', async () => {
    renderWorkspace('compact');

    const menu = within(screen.getByRole('banner')).getByRole('button', { name: 'Menu' });
    await userEvent.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Videos' })
    ).toBeInTheDocument();
  });

  it('asks for its root around a part', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<StudioWorkspace.Content />)).toThrow(
      'StudioWorkspace.Content must be inside StudioWorkspace.Root'
    );
  });

  it.each([
    { scenario: 'loaded', draw: () => renderWorkspace('large') },
    {
      scenario: 'as a skeleton',
      draw: () =>
        render(
          <AppProviders>
            <main>
              <StudioWorkspaceSkeleton />
            </main>
          </AppProviders>
        ),
    },
  ])('passes axe $scenario', async ({ draw }) => {
    draw();

    expect(await axeViolations()).toEqual([]);
  });
});
