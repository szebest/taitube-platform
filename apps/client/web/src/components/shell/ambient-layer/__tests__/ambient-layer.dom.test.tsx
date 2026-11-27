import { render, screen } from '@testing-library/react';
import { AmbientGlowProvider, useAmbientGlow } from '#app/lib/ambient/ambient-glow';
import { AmbientLayer } from '../ambient-layer';

class StubResizeObserver {
  observe() {}
  disconnect() {}
}

function Stage({ colors }: { colors: string[] }) {
  const ref = useAmbientGlow(colors);
  return <div ref={ref}>stage</div>;
}

function renderLayer(colors: string[]) {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  return render(
    <AmbientGlowProvider>
      <AmbientLayer />
      <Stage colors={colors} />
    </AmbientGlowProvider>
  );
}

describe('apps/client/web: AmbientLayer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is hidden from assistive technology and draws nothing until a page asks for a glow', () => {
    const { container } = render(
      <AmbientGlowProvider>
        <AmbientLayer />
      </AmbientGlowProvider>
    );

    expect(container.querySelector('[data-slot="ambient-layer"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(container.querySelector('[data-slot="ambient-stage"]')).toBeNull();
  });

  it('draws one band per colour, sized from the stage', () => {
    const { container } = renderLayer(['rgb(200 120 40)', 'rgb(90 40 20)']);

    expect(screen.getByText('stage')).toBeInTheDocument();
    const stage = container.querySelector('[data-slot="ambient-stage"]');
    expect(stage?.querySelectorAll('span')).toHaveLength(2);
    expect(stage).toHaveStyle({ width: '0px', height: '0px' });
  });
});
