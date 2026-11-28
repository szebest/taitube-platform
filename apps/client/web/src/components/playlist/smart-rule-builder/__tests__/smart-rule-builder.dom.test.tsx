import { axeViolations } from '@kit/web-testing/dom';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SmartRuleBuilder } from '..';

interface Setup {
  onRemove?: () => void;
  onAdd?: () => void;
  addDisabled?: boolean;
}

const renderBuilder = ({ onRemove = vi.fn(), onAdd = vi.fn(), addDisabled }: Setup = {}) =>
  render(
    <SmartRuleBuilder.Root aria-label="Rules">
      <SmartRuleBuilder.Match>
        <label>
          Match
          <select defaultValue="all">
            <option value="all">all</option>
            <option value="any">any</option>
          </select>
        </label>
      </SmartRuleBuilder.Match>
      <SmartRuleBuilder.Conditions>
        <SmartRuleBuilder.Condition onRemove={onRemove} removeLabel="Remove condition 1">
          <input aria-label="Channel" defaultValue="Marta Reis Films" />
        </SmartRuleBuilder.Condition>
        <SmartRuleBuilder.Condition onRemove={vi.fn()} removeLabel="Remove condition 2">
          <input aria-label="Longer than" defaultValue="10" />
        </SmartRuleBuilder.Condition>
      </SmartRuleBuilder.Conditions>
      <SmartRuleBuilder.Add onClick={onAdd} disabled={addDisabled}>
        Add condition
      </SmartRuleBuilder.Add>
      <SmartRuleBuilder.Footer>
        <input aria-label="Limit" defaultValue="50" />
      </SmartRuleBuilder.Footer>
    </SmartRuleBuilder.Root>
  );

describe('apps/client/web: SmartRuleBuilder', () => {
  it('is a labelled group holding an ordered list of conditions', () => {
    renderBuilder();

    const group = screen.getByRole('group', { name: 'Rules' });

    expect(within(group).getByRole('list').tagName).toBe('OL');
    expect(within(group).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the caller controls in the match row, the conditions and the footer', () => {
    renderBuilder();

    expect(screen.getByLabelText('Match')).toBeInTheDocument();
    expect(screen.getByLabelText('Channel')).toHaveValue('Marta Reis Films');
    expect(screen.getByLabelText('Limit')).toHaveValue('50');
  });

  it('removes the condition whose button was pressed', async () => {
    const onRemove = vi.fn();
    renderBuilder({ onRemove });

    await userEvent.click(screen.getByRole('button', { name: 'Remove condition 1' }));

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it.each([
    { addDisabled: false, calls: 1 },
    { addDisabled: true, calls: 0 },
  ])('calls onAdd $calls times when disabled is $addDisabled', async ({ addDisabled, calls }) => {
    const onAdd = vi.fn();
    renderBuilder({ onAdd, addDisabled });

    await userEvent.click(screen.getByRole('button', { name: 'Add condition' }));

    expect(onAdd).toHaveBeenCalledTimes(calls);
  });

  it('passes axe', async () => {
    renderBuilder();

    expect(await axeViolations()).toEqual([]);
  });
});
