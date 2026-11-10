import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { QueueActions, type QueueActionsProps } from '../queue-actions';

const ALL = { approve: true, hide: true, remove: true, restrict: true };

const renderActions = (props: Partial<QueueActionsProps> = {}) => {
  const onKey = vi.fn();
  render(
    <QueueActions
      abilities={ALL}
      hide="silent"
      remove="visible"
      flipped={false}
      selected={false}
      pending={false}
      canMovePrevious
      canMoveNext
      onKey={onKey}
      {...props}
    />,
    { wrapper: AppProviders }
  );
  return onKey;
};

const names = () =>
  screen.getAllByRole('button').map((button) => button.getAttribute('aria-keyshortcuts'));

describe('apps/client/studio: QueueActions', () => {
  it('has one button for every key, each running its key', async () => {
    const onKey = renderActions();

    for (const button of screen.getAllByRole('button')) await userEvent.click(button);

    expect(names()).toEqual(['a', 'r', 'h', 'b', 'v', 'x', 'k', 'j', '?']);
    expect(onKey.mock.calls.map(([key]) => key)).toEqual(names());
  });

  it.each([
    { hide: 'silent', remove: 'visible', names: ['Hide · Silent', 'Remove · Visible'] },
    {
      hide: undefined,
      remove: undefined,
      names: ['Hide · Channel default', 'Remove · Channel default'],
    },
  ] as const)('shows who the next hide and remove tell: $names', ({ hide, remove, names }) => {
    renderActions({ hide, remove });

    for (const name of names) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it.each([true, false])('presses v while the disclosure is flipped: %s', (flipped) => {
    renderActions({ flipped });

    expect(screen.getByRole('button', { name: 'Flip who is told' })).toHaveAttribute(
      'aria-pressed',
      String(flipped)
    );
  });

  it.each([
    { abilities: { ...ALL, approve: false }, hidden: 'Approve' },
    { abilities: { ...ALL, remove: false }, hidden: 'Remove · Visible' },
    { abilities: { ...ALL, hide: false }, hidden: 'Hide · Silent' },
    { abilities: { ...ALL, restrict: false }, hidden: 'Ban' },
  ])('leaves out $hidden when the role may not', ({ abilities, hidden }) => {
    renderActions({ abilities });

    expect(screen.queryByRole('button', { name: hidden })).not.toBeInTheDocument();
  });

  it('presses select when the comment is marked, and holds the moves at the ends', () => {
    renderActions({ selected: true, canMovePrevious: false, canMoveNext: false });

    expect(screen.getByRole('button', { name: 'Unselect' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('holds the actions on the comment while one runs', () => {
    renderActions({ pending: true });

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();
  });

  it('passes axe', async () => {
    renderActions();

    expect(await axeViolations()).toEqual([]);
  });
});
