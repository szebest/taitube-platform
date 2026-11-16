import { render, screen, waitFor } from '@testing-library/react';
import { Direction } from 'radix-ui';
import type { Ref } from 'react';
import { useSlidingIndicator } from '../sliding-indicator';

const OFFSETS = ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight'] as const;

type Geometry = (typeof OFFSETS)[number] | 'clientWidth';

const GEOMETRY: Record<string, Partial<Record<Geometry, number>>> = {
  options: { clientWidth: 300 },
  top: { offsetLeft: 4, offsetTop: 2, offsetWidth: 60, offsetHeight: 32 },
  newest: { offsetLeft: 68, offsetTop: 2, offsetWidth: 80, offsetHeight: 32 },
};

const measured = (property: Geometry) =>
  function (this: HTMLElement) {
    return GEOMETRY[this.dataset.testid ?? '']?.[property] ?? 0;
  };

const stubGeometry = () => {
  for (const property of OFFSETS) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockImplementation(measured(property));
  }
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(measured('clientWidth'));
};

function Options({
  selected,
  ref,
}: Readonly<{ selected: string | undefined; ref?: Ref<HTMLDivElement> }>) {
  return (
    <div ref={useSlidingIndicator('[data-state="on"]', ref)} data-testid="options">
      {['top', 'newest'].map((value) => (
        <span key={value} data-testid={value} data-state={value === selected ? 'on' : 'off'} />
      ))}
    </div>
  );
}

const renderOptions = (
  selected: string | undefined,
  { dir = 'ltr', ref }: Readonly<{ dir?: 'ltr' | 'rtl'; ref?: Ref<HTMLDivElement> }> = {}
) => {
  stubGeometry();
  const view = render(
    <Direction.Provider dir={dir}>
      <Options selected={selected} ref={ref} />
    </Direction.Provider>
  );
  const options = screen.getByTestId('options');
  const box = () =>
    ['x', 'y', 'width', 'height'].map((axis) =>
      options.style.getPropertyValue(`--indicator-${axis}`)
    );
  const select = (value: string) =>
    view.rerender(
      <Direction.Provider dir={dir}>
        <Options selected={value} ref={ref} />
      </Direction.Provider>
    );
  return { options, box, select };
};

describe('@vp/ui: useSlidingIndicator', () => {
  it.each([
    { dir: 'ltr', x: '4px' },
    { dir: 'rtl', x: '-236px' },
  ] as const)('places the indicator on the selected option reading $dir', ({ dir, x }) => {
    const { options, box } = renderOptions('top', { dir });

    expect(options).toHaveAttribute('data-indicator', 'shown');
    expect(box()).toEqual([x, '2px', '60px', '32px']);
  });

  it('follows a new selection', async () => {
    const { box, select } = renderOptions('top');

    select('newest');

    await waitFor(() => expect(box()).toEqual(['68px', '2px', '80px', '32px']));
  });

  it('shows no indicator while nothing is selected', () => {
    const { options } = renderOptions(undefined);

    expect(options).not.toHaveAttribute('data-indicator');
  });

  it.each([
    { kind: 'object', make: () => ({ current: null as HTMLDivElement | null }) },
    { kind: 'callback', make: () => vi.fn<(node: HTMLDivElement | null) => void>() },
  ])("hands the container to the caller's $kind ref", ({ make }) => {
    const ref = make();
    const { options } = renderOptions('top', { ref });

    if (typeof ref === 'function') {
      expect(ref).toHaveBeenCalledWith(options);
    } else {
      expect(ref.current).toBe(options);
    }
  });
});
