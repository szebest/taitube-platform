import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PlaylistSectionRow, type PlaylistSectionRowRootProps } from '..';

const renderSection = (props: Partial<PlaylistSectionRowRootProps> = {}) =>
  render(
    <PlaylistSectionRow.Root folded={false} onFoldedChange={vi.fn()} {...props}>
      <PlaylistSectionRow.Title>Night trams</PlaylistSectionRow.Title>
      <PlaylistSectionRow.Count>4 videos</PlaylistSectionRow.Count>
      <PlaylistSectionRow.Actions>
        <button type="button">Section options</button>
      </PlaylistSectionRow.Actions>
    </PlaylistSectionRow.Root>
  );

describe('apps/client/web: PlaylistSectionRow', () => {
  it.each([
    { folded: false, expanded: 'true', next: true },
    { folded: true, expanded: 'false', next: false },
  ])(
    'says aria-expanded=$expanded when folded is $folded and asks for folded=$next on click',
    async ({ folded, expanded, next }) => {
      const onFoldedChange = vi.fn();
      renderSection({ folded, onFoldedChange });

      const title = screen.getByRole('button', { name: 'Night trams' });
      await userEvent.click(title);

      expect(title).toHaveAttribute('aria-expanded', expanded);
      expect(onFoldedChange).toHaveBeenCalledWith(next);
    }
  );

  it('turns the chevron when folded', () => {
    const { container } = renderSection({ folded: true });

    expect(container.querySelector('[data-icon=chevron-down]')).toHaveClass('-rotate-90');
  });

  it('shows the count and the caller actions', () => {
    renderSection();

    expect(screen.getByText('4 videos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section options' })).toBeInTheDocument();
  });

  it('throws for a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<PlaylistSectionRow.Title>Alone</PlaylistSectionRow.Title>)).toThrow(
      'PlaylistSectionRow.Title must be inside PlaylistSectionRow.Root'
    );
  });

  it.each([{ folded: false }, { folded: true }])(
    'passes axe when folded is $folded',
    async ({ folded }) => {
      renderSection({ folded });

      expect(await axeViolations()).toEqual([]);
    }
  );
});
