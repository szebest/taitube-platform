import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { PollView } from '..';

interface PollCase {
  revealed: boolean;
  votedIndex?: number | null;
  correctIndex?: number | null;
}

function renderPoll({ revealed, votedIndex = null, correctIndex = null }: PollCase) {
  return renderPage(
    <PollView.Root
      question="Which tram next?"
      revealed={revealed}
      votedIndex={votedIndex}
      correctIndex={correctIndex}
      onVote={() => undefined}
    >
      <PollView.Options>
        <PollView.Option index={0} text="Line 28" votes={revealed ? 3 : null} share={75} />
        <PollView.Option index={1} text="Line 15" votes={revealed ? 1 : null} share={25} />
      </PollView.Options>
      <PollView.Footer>4 votes</PollView.Footer>
      <PollView.Explanation>It opened in 1929.</PollView.Explanation>
    </PollView.Root>,
    AppProviders
  );
}

describe('apps/client/web: PollView', () => {
  it('names the group by its question', async () => {
    const markup = await renderPoll({ revealed: false });

    expect(markup).toContain('role="group"');
    expect(markup).toContain('>Which tram next?</p>');
  });

  it('draws each option as a button and no percent before the results show', async () => {
    const markup = await renderPoll({ revealed: false });

    expect(markup.match(/<button/g)).toHaveLength(2);
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain('%');
  });

  it('draws each option as a bar with its share once the results show', async () => {
    const markup = await renderPoll({ revealed: true, votedIndex: 0 });

    expect(markup).not.toContain('<button');
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2);
    expect(markup).toContain('75%');
    expect(markup).toContain('25%');
  });

  it.each([
    {
      name: 'the option the viewer chose',
      votedIndex: 1,
      correctIndex: null,
      state: 'chosen',
      label: 'Your vote',
    },
    {
      name: 'the right quiz option',
      votedIndex: 0,
      correctIndex: 1,
      state: 'correct',
      label: 'Correct answer',
    },
  ])('marks $name', async ({ votedIndex, correctIndex, state, label }) => {
    const markup = await renderPoll({ revealed: true, votedIndex, correctIndex });

    expect(markup).toContain(`data-state="${state}"`);
    expect(markup).toContain(label);
  });

  it('puts the footer and the explanation under the options', async () => {
    const markup = await renderPoll({ revealed: true, votedIndex: 0 });

    expect(markup).toContain('4 votes');
    expect(markup).toContain('It opened in 1929.');
  });
});
