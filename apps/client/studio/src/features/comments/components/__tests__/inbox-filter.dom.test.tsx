import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { InboxFilter, type InboxFilterProps } from '../inbox-filter';

const renderFilter = ({ value = 'all', onChange = vi.fn() }: Partial<InboxFilterProps> = {}) =>
  render(
    <AppProviders>
      <InboxFilter value={value} onChange={onChange} />
    </AppProviders>
  );

describe('apps/client/studio: InboxFilter', () => {
  it('offers the three filters, marks the current one and asks for the one picked', async () => {
    const onChange = vi.fn();
    renderFilter({ value: 'unanswered', onChange });

    await userEvent.click(screen.getByRole('radio', { name: 'Reported' }));

    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'All',
      'Unanswered',
      'Reported',
    ]);
    expect(screen.getByRole('radio', { name: 'Unanswered' })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('reported');
  });
});
