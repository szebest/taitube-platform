import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { LinerNotes, LinerNotesSkeleton } from '..';
import type { LinerNotesRootProps } from '../liner-notes';

const renderNotes = (props: Partial<LinerNotesRootProps> = {}) =>
  render(
    <AppProviders>
      <LinerNotes.Root onSeek={vi.fn()} {...props}>
        <LinerNotes.Meta>412K views · 2 days ago</LinerNotes.Meta>
        <LinerNotes.Body>
          No music, only the city. <LinerNotes.Timecode seconds={135}>02:15</LinerNotes.Timecode> is
          the tram.
        </LinerNotes.Body>
        <LinerNotes.Chapters>
          <LinerNotes.Chapter id="arrival" seconds={0} time="00:00">
            Arrival
          </LinerNotes.Chapter>
          <LinerNotes.Chapter id="rain" seconds={400} time="06:40" current>
            Rain
          </LinerNotes.Chapter>
        </LinerNotes.Chapters>
      </LinerNotes.Root>
    </AppProviders>
  );

describe('apps/client/web: LinerNotes', () => {
  it('is a description section that expands and collapses its notes', async () => {
    const onExpandedChange = vi.fn();
    renderNotes({ onExpandedChange });
    const toggle = screen.getByRole('button', { name: 'Show more' });

    expect(screen.getByRole('region', { name: 'Description' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveTextContent(
      'No music'
    );

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('follows the expanded state it is handed', () => {
    renderNotes({ expanded: true });

    expect(screen.getByRole('region')).toHaveAttribute('data-expanded', 'true');
  });

  it.each([
    { name: 'Seek to 02:15', seconds: 135 },
    { name: '00:00 Arrival', seconds: 0 },
    { name: '06:40 Rain', seconds: 400 },
  ])('seeks to $seconds from $name', async ({ name, seconds }) => {
    const onSeek = vi.fn();
    renderNotes({ onSeek });

    await userEvent.click(screen.getByRole('button', { name }));

    expect(onSeek).toHaveBeenCalledWith(seconds);
  });

  it('lists the chapters in a labelled strip, the current one marked', () => {
    renderNotes();

    expect(screen.getByRole('navigation', { name: 'Chapters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '06:40 Rain' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('button', { name: '00:00 Arrival' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderNotes();
    render(<LinerNotesSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
