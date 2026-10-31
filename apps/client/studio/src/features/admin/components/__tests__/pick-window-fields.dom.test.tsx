import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import type { WindowIssue } from '#app/features/admin/lib/pick-schedule';
import { PickWindowFields, type PickWindowFieldsProps } from '../pick-window-fields';
import { adminPick } from './picks.fixture';

const renderWindow = (issue?: WindowIssue) => {
  const onChange = vi.fn();
  const props: PickWindowFieldsProps = {
    startsAt: '2026-11-02T09:00',
    endsAt: '2026-11-03T09:00',
    onChange,
    issue,
  };
  render(<PickWindowFields {...props} />, { wrapper: AppProviders });
  return { onChange };
};

describe('apps/client/studio: PickWindowFields', () => {
  it.each([
    { label: 'Starts', changes: { startsAt: '2026-11-04T10:00' } },
    { label: 'Ends', changes: { endsAt: '2026-11-04T10:00' } },
  ])('reports a new value for $label', ({ label, changes }) => {
    const { onChange } = renderWindow();

    fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-11-04T10:00' } });

    expect(onChange).toHaveBeenCalledWith(changes);
  });

  it('says nothing while the window is fine', () => {
    renderWindow();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Starts')).toBeValid();
  });

  it.each([
    { name: 'a refused window', issue: { kind: 'invalid', message: 'Too late' }, text: 'Too late' },
    {
      name: 'a missing instant',
      issue: { kind: 'incomplete' },
      text: 'Set when the pick starts and ends.',
    },
    {
      name: 'a clash with another pick',
      issue: { kind: 'overlap', pick: adminPick() },
      text: /This window overlaps another pick: Mountain lakes, /,
    },
  ] as const)('shows $name', ({ issue, text }) => {
    renderWindow(issue);

    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.getByLabelText('Ends')).toBeInvalid();
  });
});
