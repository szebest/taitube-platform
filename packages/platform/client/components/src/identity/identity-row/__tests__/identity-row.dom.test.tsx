import { render, screen } from '@testing-library/react';
import { IdentityRow } from '..';

function renderRow(props: { current?: boolean; expired?: boolean; accent?: 1 | 4 }) {
  return render(
    <IdentityRow.Root current={props.current} expired={props.expired} data-testid="row">
      <IdentityRow.Avatar name="Ada Lovelace" accent={props.accent} />
      <IdentityRow.Text>
        <IdentityRow.Name>Ada Lovelace</IdentityRow.Name>
        <IdentityRow.Detail>@ada</IdentityRow.Detail>
      </IdentityRow.Text>
      <IdentityRow.Unread aria-label="3 unread">3</IdentityRow.Unread>
      <IdentityRow.Check />
    </IdentityRow.Root>
  );
}

describe('@kit/components: IdentityRow', () => {
  it('draws the avatar initials, the name, the detail and the count', () => {
    renderRow({});

    expect(screen.getByTestId('row')).toHaveTextContent('ALAda Lovelace@ada3');
    expect(screen.getByLabelText('3 unread')).toBeInTheDocument();
  });

  it.each([
    { state: 'current', props: { current: true }, attribute: 'data-current', checkShown: true },
    { state: 'expired', props: { expired: true }, attribute: 'data-expired', checkShown: false },
  ])('marks the $state row', ({ props, attribute, checkShown }) => {
    const { container } = renderRow(props);

    expect(screen.getByTestId('row')).toHaveAttribute(attribute);
    expect(container.querySelector('svg')?.getAttribute('class')).toEqual(
      checkShown ? expect.not.stringContaining('invisible') : expect.stringContaining('invisible')
    );
  });

  it.each([
    { accent: 4 as const, ring: true },
    { accent: undefined, ring: false },
  ])('rings the avatar only when given accent $accent', ({ accent, ring }) => {
    const { container } = renderRow({ accent });

    expect(container.querySelector('[data-slot="accent-ring"]') !== null).toBe(ring);
  });
});
