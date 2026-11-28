import { axeViolations } from '@kit/web-testing/dom';
import { render, screen, within } from '@testing-library/react';
import { ActivityList } from '..';

const ENTRIES = [
  {
    id: 'a',
    text: 'Ana added Lisbon trams',
    time: '2026-11-26T09:00:00Z',
    label: '1 day ago',
    src: '/ana.jpg',
  },
  {
    id: 'b',
    text: 'Bruno removed Alfama at 5 a.m.',
    time: '2026-11-25T18:30:00Z',
    label: '2 days ago',
    src: undefined,
  },
];

const renderList = () =>
  render(
    <ActivityList.Root aria-label="Activity">
      {ENTRIES.map((entry) => (
        <ActivityList.Item key={entry.id}>
          <ActivityList.Avatar src={entry.src} name={entry.text} />
          <ActivityList.Text>{entry.text}</ActivityList.Text>
          <ActivityList.Time dateTime={entry.time}>{entry.label}</ActivityList.Time>
          {entry.id === 'b' && (
            <ActivityList.Action>
              <button type="button">Restore</button>
            </ActivityList.Action>
          )}
        </ActivityList.Item>
      ))}
    </ActivityList.Root>
  );

describe('apps/client/web: ActivityList', () => {
  it('is a labelled ordered list with one item per entry', () => {
    renderList();

    expect(screen.getByRole('list', { name: 'Activity' }).tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(ENTRIES.length);
  });

  it.each(ENTRIES)('shows "$text" with a time element for $time', ({ text, time, label }) => {
    renderList();

    const row = screen.getByText(text).closest('li') as HTMLElement;

    expect(within(row).getByText(label).tagName).toBe('TIME');
    expect(within(row).getByText(label)).toHaveAttribute('datetime', time);
  });

  it('puts the caller action on its entry only', () => {
    renderList();

    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(1);
    expect(
      within(
        screen.getByText('Bruno removed Alfama at 5 a.m.').closest('li') as HTMLElement
      ).getByRole('button', { name: 'Restore' })
    ).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderList();

    expect(await axeViolations()).toEqual([]);
  });
});
