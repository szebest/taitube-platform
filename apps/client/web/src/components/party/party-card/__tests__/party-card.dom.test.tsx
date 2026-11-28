import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { PartyCard, type PartyCardState } from '..';

const renderCard = (state?: PartyCardState, progress: number | null = 0.4) =>
  render(
    <AppProviders>
      <PartyCard.Root state={state}>
        <PartyCard.Thumb progress={progress}>
          <PartyCard.Pill>Now playing</PartyCard.Pill>
        </PartyCard.Thumb>
        <PartyCard.Title asChild>
          <a href="/parties/1">Movie night</a>
        </PartyCard.Title>
        <PartyCard.Host name="Ana" channelBadge="Ana hosts" />
        <PartyCard.Roster
          faces={[{ name: 'Bruno', avatarUrl: null }]}
          watching="12 watching"
          more={['+9']}
        />
        <PartyCard.Meta>
          <span>12 / 20</span>
        </PartyCard.Meta>
        <PartyCard.Action>Join</PartyCard.Action>
      </PartyCard.Root>
    </AppProviders>
  );

describe('apps/client/web: PartyCard', () => {
  it('stretches the room link over the card and puts the action above it', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Movie night' })).toHaveAttribute('href', '/parties/1');
    expect(screen.getByText('Join')).toHaveAttribute('data-slot', 'party-card-action');
  });

  it('shows the roster as faces and the counts the faces leave out', () => {
    renderCard();

    expect(screen.getByText('12 watching')).toBeInTheDocument();
    expect(screen.getByText('+9')).toBeInTheDocument();
  });

  it.each([
    { state: undefined, expected: 'open' },
    { state: 'full', expected: 'full' },
    { state: 'ended', expected: 'ended' },
  ] as const)('marks the card $expected', ({ state, expected }) => {
    renderCard(state);

    expect(screen.getByRole('article')).toHaveAttribute('data-state', expected);
  });

  it('draws the progress bar only while there is a position', () => {
    const { unmount } = renderCard('open', 0.4);
    expect(document.querySelector('[role="progressbar"]')).not.toBeNull();
    unmount();

    renderCard('open', null);
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    renderCard();

    expect(await axeViolations()).toEqual([]);
  });

  it('refuses a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<PartyCard.Title>Orphan</PartyCard.Title>)).toThrow(/PartyCard.Title/);
  });
});
