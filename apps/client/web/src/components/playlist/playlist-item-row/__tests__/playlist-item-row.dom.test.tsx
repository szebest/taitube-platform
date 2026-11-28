import { SortableList } from '@kit/ui';
import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { PlaylistItemRow, type PlaylistItemRowRootProps } from '..';

interface Setup {
  root?: Partial<PlaylistItemRowRootProps>;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  parts?: ReactNode;
}

const renderRow = ({ root = {}, checked, onCheckedChange = vi.fn(), parts }: Setup = {}) =>
  render(
    <AppProviders>
      <SortableList.Root items={['v1']} onReorder={vi.fn()} aria-label="Videos">
        <SortableList.Item id="v1" aria-label="Lisbon trams">
          <PlaylistItemRow.Root {...root}>
            {checked !== undefined && (
              <PlaylistItemRow.Select
                aria-label="Select Lisbon trams"
                checked={checked}
                onCheckedChange={onCheckedChange}
              />
            )}
            <PlaylistItemRow.Body>
              <a href="/watch/v1">Lisbon trams</a>
            </PlaylistItemRow.Body>
            {parts}
          </PlaylistItemRow.Root>
        </SortableList.Item>
      </SortableList.Root>
    </AppProviders>
  );

const row = (container: HTMLElement) => container.querySelector('[data-slot=playlist-item-row]');

describe('apps/client/web: PlaylistItemRow', () => {
  it.each([
    { selected: true, attribute: 'true' },
    { selected: false, attribute: null },
  ])('sets data-selected to $attribute when selected is $selected', ({ selected, attribute }) => {
    const { container } = renderRow({ root: { selected } });

    expect(row(container)?.getAttribute('data-selected')).toBe(attribute);
  });

  it.each([
    { checked: false, click: true },
    { checked: true, click: false },
  ])(
    'reports $click when the checkbox starts $checked and is clicked',
    async ({ checked, click }) => {
      const onCheckedChange = vi.fn();
      renderRow({ checked, onCheckedChange });

      await userEvent.click(screen.getByRole('checkbox', { name: 'Select Lisbon trams' }));

      expect(onCheckedChange).toHaveBeenCalledWith(click);
    }
  );

  it('has no checkbox unless a Select part is rendered', () => {
    renderRow();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it.each([
    {
      part: <PlaylistItemRow.Note>Watch with the sound off</PlaylistItemRow.Note>,
      text: 'Watch with the sound off',
      icon: 'edit',
    },
    {
      part: <PlaylistItemRow.Segment>0:30 to 1:45</PlaylistItemRow.Segment>,
      text: '0:30 to 1:45',
      icon: 'clip',
    },
  ])('draws $text with its $icon icon', ({ part, text, icon }) => {
    const { container } = renderRow({ parts: part });

    const shown = screen.getByText(text).closest('p, span[data-slot]') as HTMLElement;

    expect(shown).toBeInTheDocument();
    expect(container.querySelector(`[data-icon=${icon}]`)).toBeInTheDocument();
  });

  it('clamps the note to three lines', () => {
    renderRow({ parts: <PlaylistItemRow.Note>A very long note</PlaylistItemRow.Note> });

    expect(screen.getByText('A very long note')).toHaveClass('line-clamp-3');
  });

  it.each([{ src: undefined }, { src: '/ana.jpg' }])(
    'names the adder by its label when src is $src',
    ({ src }) => {
      renderRow({
        parts: <PlaylistItemRow.Adder src={src} name="Ana" label="Added by Ana" />,
      });

      expect(screen.getByRole('img', { name: 'Added by Ana' })).toBeInTheDocument();
    }
  );

  it('shows the label in a tooltip when the adder is reached by keyboard', async () => {
    renderRow({ parts: <PlaylistItemRow.Adder src={undefined} name="Ana" label="Added by Ana" /> });

    await userEvent.tab();
    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Added by Ana');
  });

  it('passes axe with every part', async () => {
    renderRow({
      checked: false,
      parts: (
        <>
          <PlaylistItemRow.Note>Watch with the sound off</PlaylistItemRow.Note>
          <PlaylistItemRow.Segment>0:30 to 1:45</PlaylistItemRow.Segment>
          <PlaylistItemRow.Adder src={undefined} name="Ana" label="Added by Ana" />
        </>
      ),
    });

    expect(await axeViolations()).toEqual([]);
  });
});
