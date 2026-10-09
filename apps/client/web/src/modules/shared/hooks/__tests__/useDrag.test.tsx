import { renderToStaticMarkup } from 'react-dom/server';
import { useDrag } from '../useDrag';

type DragControls = Partial<ReturnType<typeof useDrag>>;

function renderDrag(controls: DragControls = {}): string {
  function DragProbe() {
    const drag = useDrag();
    Object.assign(controls, drag);
    return <span>{drag.dragging ? 'dragging' : 'idle'}</span>;
  }

  return renderToStaticMarkup(<DragProbe />);
}

describe('apps/web: drag to scroll', () => {
  it('is idle before any press', () => {
    expect(renderDrag()).toContain('idle');
  });

  it('never scrolls when the pointer moves without a press', () => {
    const controls: DragControls = {};
    const onScroll = vi.fn();
    renderDrag(controls);

    controls.dragMove?.({ clientX: 300 }, onScroll);

    expect(onScroll).not.toHaveBeenCalled();
  });

  it('lets go on the next animation frame, so the click that ends a drag still sees it', () => {
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal('window', { requestAnimationFrame });
    const controls: DragControls = {};
    renderDrag(controls);

    controls.dragStop?.();

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
