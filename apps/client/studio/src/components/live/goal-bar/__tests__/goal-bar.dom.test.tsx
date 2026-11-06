import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { GoalBar } from '../index';

interface GoalProps {
  value: number;
  max: number;
}

const renderGoalBar = ({ value, max }: GoalProps = { value: 12, max: 25 }) =>
  render(
    <GoalBar.Root>
      <GoalBar.Label>Subscriber goal</GoalBar.Label>
      <GoalBar.Count>
        {value} of {max}
      </GoalBar.Count>
      <GoalBar.Bar aria-label="Subscriber goal" value={value} max={max} />
    </GoalBar.Root>
  );

describe('GoalBar', () => {
  it.each([
    { value: 0, max: 10 },
    { value: 12, max: 25 },
    { value: 25, max: 25 },
  ])('reports $value of $max to assistive technology', (props) => {
    renderGoalBar(props);

    const bar = screen.getByRole('progressbar', { name: 'Subscriber goal' });

    expect(bar).toHaveAttribute('aria-valuenow', String(props.value));
    expect(bar).toHaveAttribute('aria-valuemax', String(props.max));
  });

  it('passes axe', async () => {
    renderGoalBar();

    expect(await axeViolations()).toEqual([]);
  });
});
