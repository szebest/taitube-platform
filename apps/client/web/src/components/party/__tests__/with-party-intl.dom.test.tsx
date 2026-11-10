import { composeStory } from '@storybook/react-vite';
import { render, screen } from '@testing-library/react';
import { useT } from '@vp/intl-react';
import { withPartyIntl } from '../__stories__/with-party-intl';

function LobbyPhase() {
  return <p>{useT().tOr('party.phaseLobby', {}, '')}</p>;
}

describe('withPartyIntl', () => {
  it('lets a story read the catalogue through useT', () => {
    const Story = composeStory(
      { render: () => <LobbyPhase /> },
      { title: 'Probe' },
      { decorators: [withPartyIntl] }
    );

    render(<Story />);

    expect(screen.getByText('Waiting to start')).toBeInTheDocument();
  });
});
