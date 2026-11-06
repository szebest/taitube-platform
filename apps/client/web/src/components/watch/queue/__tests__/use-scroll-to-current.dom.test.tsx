import { renderHook } from '@testing-library/react';

import { useScrollToCurrent } from '../use-scroll-to-current';

function renderScroll(initial: string) {
  const scrolled: string[] = [];
  const list = document.createElement('ul');
  for (const id of ['a', 'b']) {
    const item = document.createElement('li');
    item.id = id;
    item.scrollIntoView = () => scrolled.push(id);
    list.append(item);
  }
  const mark = (id: string) => {
    for (const item of list.children) {
      if (item.id === id) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }
  };
  mark(initial);

  const hook = renderHook(
    ({ id }) => {
      const ref = useScrollToCurrent<HTMLUListElement>(id);
      ref.current = list;
      return ref;
    },
    { initialProps: { id: initial } }
  );
  return { scrolled, hook, mark };
}

describe('apps/client/web: useScrollToCurrent', () => {
  it('leaves the list alone on the first render', () => {
    expect(renderScroll('a').scrolled).toEqual([]);
  });

  it('scrolls the new current item into view once the current one changes', () => {
    const { scrolled, hook, mark } = renderScroll('a');

    mark('b');
    hook.rerender({ id: 'b' });

    expect(scrolled).toEqual(['b']);
  });
});
