import { render } from '@testing-library/react';
import { createContext, use } from 'react';
import { createRenderCounter } from '../render-counter';

const Shared = createContext({ tick: 0 });

function Reader() {
  return <span>{use(Shared).tick}</span>;
}

function renderCounted(value: { tick: number }) {
  const { Counted, commitsOf } = createRenderCounter();
  const reader = (
    <Counted id="reader">
      <Reader />
    </Counted>
  );
  const view = render(<Shared value={value}>{reader}</Shared>);
  return {
    rerender: (next: { tick: number }) => view.rerender(<Shared value={next}>{reader}</Shared>),
    commitsOf,
  };
}

describe('@vp/web-testing: createRenderCounter', () => {
  it.each([
    { change: 'the same value', next: (value: { tick: number }) => value, commits: 1 },
    { change: 'a new value', next: () => ({ tick: 0 }), commits: 2 },
  ])('counts one commit at mount and one more for $change', ({ next, commits }) => {
    const value = { tick: 0 };
    const { rerender, commitsOf } = renderCounted(value);

    rerender(next(value));

    expect(commitsOf('reader')).toBe(commits);
  });

  it('counts nothing for a subtree it never rendered', () => {
    expect(createRenderCounter().commitsOf('absent')).toBe(0);
  });
});
