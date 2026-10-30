import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { FilterSelect } from '../filter-select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

const renderSelect = (value: 'a' | 'b' | undefined = undefined) => {
  const onChange = vi.fn();
  render(<FilterSelect label="Letter" value={value} options={OPTIONS} onChange={onChange} />, {
    wrapper: AppProviders,
  });
  return { onChange, user: userEvent.setup() };
};

describe('apps/client/studio: FilterSelect', () => {
  it('shows no filter as All', () => {
    renderSelect();

    expect(screen.getByRole('combobox', { name: 'Letter' })).toHaveTextContent('All');
  });

  it('shows the chosen option by its label', () => {
    renderSelect('b');

    expect(screen.getByRole('combobox', { name: 'Letter' })).toHaveTextContent('Beta');
  });

  it.each([
    { picked: 'Alpha', value: 'a' },
    { picked: 'All', value: undefined },
  ])('reports $picked as $value', async ({ picked, value }) => {
    const { onChange, user } = renderSelect('b');

    await user.click(screen.getByRole('combobox', { name: 'Letter' }));
    await user.click(await screen.findByRole('option', { name: picked }));

    expect(onChange).toHaveBeenCalledWith(value);
  });
});
