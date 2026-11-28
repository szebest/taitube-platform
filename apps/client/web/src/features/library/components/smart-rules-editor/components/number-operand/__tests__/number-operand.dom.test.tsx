import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { NumberOperand } from '../number-operand';

async function renderNumber(value: number) {
  const onChange = vi.fn();
  const rendered = await renderPart(
    <NumberOperand
      label="Days"
      value={value}
      max={365}
      shown={`${value} days`}
      onChange={onChange}
    />
  );
  return { ...rendered, onChange, thumb: screen.getByRole('slider', { name: 'Days' }) };
}

describe('apps/client/web: the number operand', () => {
  it('shows the value in words beside a slider that holds it', async () => {
    const { thumb } = await renderNumber(30);

    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(thumb).toHaveAttribute('aria-valuenow', '30');
    expect(thumb).toHaveAttribute('aria-valuemin', '1');
    expect(thumb).toHaveAttribute('aria-valuemax', '365');
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    { key: '{ArrowRight}', value: 31 },
    { key: '{ArrowLeft}', value: 29 },
    { key: '{End}', value: 365 },
    { key: '{Home}', value: 1 },
  ])('hands back $value after $key', async ({ key, value }) => {
    const { user, thumb, onChange } = await renderNumber(30);

    thumb.focus();
    await user.keyboard(key);

    expect(onChange).toHaveBeenCalledWith(value);
  });
});
