import { render, screen } from '@testing-library/react';
import { AmbientGlowProvider, useAmbientGlow, useAmbientGlowState } from '../ambient-glow';

function Stage({ colors }: { colors: string[] }) {
  const ref = useAmbientGlow(colors);
  return <div ref={ref}>stage</div>;
}

function Reader() {
  const { glow } = useAmbientGlowState();
  return <p>{glow ? `${glow.colors.join(',')} on ${glow.stage.textContent}` : 'no glow'}</p>;
}

function renderGlow(colors: string[]) {
  const view = (shown: boolean, current = colors) => (
    <AmbientGlowProvider>
      <Reader />
      {shown && <Stage colors={current} />}
    </AmbientGlowProvider>
  );
  const { rerender } = render(view(true));
  return {
    hide: () => rerender(view(false)),
    recolour: (next: string[]) => rerender(view(true, next)),
  };
}

describe('apps/client/web: ambient glow', () => {
  it('shows the colours the stage asks for, sized from the stage', () => {
    renderGlow(['red', 'blue']);

    expect(screen.getByText('red,blue on stage')).toBeInTheDocument();
  });

  it('follows new colours and goes with the stage', () => {
    const { recolour, hide } = renderGlow(['red']);

    recolour(['green']);
    expect(screen.getByText('green on stage')).toBeInTheDocument();

    hide();
    expect(screen.getByText('no glow')).toBeInTheDocument();
  });

  it('draws nothing for a stage with no colours', () => {
    renderGlow([]);

    expect(screen.getByText('no glow')).toBeInTheDocument();
  });

  it('is silent without a provider', () => {
    render(<Stage colors={['red']} />);

    expect(screen.getByText('stage')).toBeInTheDocument();
  });

  it('refuses a reader outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Reader />)).toThrow('AmbientGlowProvider');
  });
});
