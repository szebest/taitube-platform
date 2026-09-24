import { renderToStaticMarkup } from 'react-dom/server';
import { DragScrollMenu } from '../drag-scroll-menu';

function Item({ itemId }: { itemId: string }) {
  return <button type="button">{itemId}</button>;
}

describe('apps/web: drag scroll menu', () => {
  it('lays its items out between a left and a right arrow', () => {
    const markup = renderToStaticMarkup(
      <DragScrollMenu>
        <Item itemId="Music" />
        <Item itemId="Gaming" />
      </DragScrollMenu>
    );

    expect(markup).toContain('Music');
    expect(markup).toContain('Gaming');
    expect(markup.indexOf('bi-arrow-left')).toBeLessThan(markup.indexOf('Music'));
    expect(markup.indexOf('bi-arrow-right')).toBeGreaterThan(markup.indexOf('Gaming'));
  });
});
