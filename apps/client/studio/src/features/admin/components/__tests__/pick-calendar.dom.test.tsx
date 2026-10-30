import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { PickCalendar, type PickCalendarProps } from '../pick-calendar';
import { adminPick, inHours } from './picks.fixture';

const renderCalendar = (props: Partial<PickCalendarProps> = {}) => {
  const onEdit = vi.fn();
  render(<PickCalendar picks={[]} now={new Date()} onEdit={onEdit} {...props} />, {
    wrapper: AppProviders,
  });
  return { onEdit, user: userEvent.setup() };
};

describe('apps/client/studio: PickCalendar', () => {
  it('lays out the next 30 days, today marked', () => {
    renderCalendar();

    const days = within(screen.getByRole('list', { name: 'The next 30 days' })).getAllByRole(
      'listitem'
    );

    expect(days).toHaveLength(30);
    expect(days.filter((day) => day.getAttribute('aria-current') === 'date')).toEqual([days[0]]);
    expect(screen.getAllByText('Nothing scheduled')).toHaveLength(30);
  });

  it('puts a pick on each day its window touches, and opens it for editing', async () => {
    const pick = adminPick({ startsAt: inHours(20), endsAt: inHours(70) });
    const { onEdit, user } = renderCalendar({ picks: [pick] });

    const chips = screen.getAllByRole('button', { name: /^Mountain lakes, .* Edit this pick\.$/ });
    await user.click(chips[0] as HTMLElement);

    expect(chips.length).toBeGreaterThan(2);
    expect(onEdit).toHaveBeenCalledWith(pick);
  });

  it('shows a pick as plain text to someone who cannot edit', () => {
    renderCalendar({ picks: [adminPick()], onEdit: undefined });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByText('Mountain lakes').length).toBeGreaterThan(0);
  });
});
