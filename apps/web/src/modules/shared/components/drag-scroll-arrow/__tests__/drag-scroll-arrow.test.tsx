import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollMenu } from 'react-horizontal-scrolling-menu';
import { LeftArrow, RightArrow } from '../drag-scroll-arrow';

type ArrowSlots = { LeftArrow?: ReactElement; RightArrow?: ReactElement };

function Item({ itemId }: { itemId: string }) {
  return <span>{itemId}</span>;
}

describe('apps/web: drag scroll arrows', () => {
  it.each<{ side: string; arrows: ArrowSlots; icon: string; disabled: boolean }>([
    { side: 'left', arrows: { LeftArrow: <LeftArrow /> }, icon: 'bi-arrow-left', disabled: true },
    { side: 'right', arrows: { RightArrow: <RightArrow /> }, icon: 'bi-arrow-right', disabled: false },
  ])(
    'renders the $side arrow, disabled=$disabled before the menu has measured its items',
    ({ arrows, icon, disabled }) => {
      const markup = renderToStaticMarkup(
        <ScrollMenu {...arrows}>
          <Item itemId="first" />
        </ScrollMenu>
      );

      expect(markup).toContain(icon);
      expect(markup.includes('disabled=""')).toBe(disabled);
    }
  );
});
