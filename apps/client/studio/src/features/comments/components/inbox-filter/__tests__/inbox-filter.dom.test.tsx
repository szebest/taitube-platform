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

const openFilter = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Show' }));
  return screen.findAllByRole('option');
};

describe('apps/client/studio: InboxFilter', () => {
  it('offers every filter, with all as no choice', async () => {
    renderFilter();

    const options = await openFilter();

    expect(options.map((option) => option.textContent)).toEqual([
      'All',
      'Unanswered',
      'Reported',
      'Held',
      'Hidden',
      'Questions',
      'Restricted',
    ]);
  });

  it.each([
    { value: 'all' as const, shown: 'All' },
    { value: 'restricted' as const, shown: 'Restricted' },
  ])('shows $value as $shown', ({ value, shown }) => {
    renderFilter({ value });

    expect(screen.getByRole('combobox', { name: 'Show' })).toHaveTextContent(shown);
  });

  it.each([
    { picked: 'Held', filter: 'held' },
    { picked: 'All', filter: 'all' },
  ])('asks for $filter when $picked is picked', async ({ picked, filter }) => {
    const onChange = vi.fn();
    renderFilter({ value: 'questions', onChange });

    await openFilter();
    await userEvent.click(screen.getByRole('option', { name: picked }));

    expect(onChange).toHaveBeenCalledWith(filter);
  });
});
