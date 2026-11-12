import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { endUpdates, LeakedUpdateError, settle, startUpdates } from '../test-settle';

function deferred() {
  let resolve: (value: string) => void = () => undefined;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderWith(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

describe('@vp/web-testing: settle', () => {
  it.each([
    {
      work: 'query',
      Component: ({ answer }: { answer: Promise<string> }) => (
        <p>{useQuery({ queryKey: ['answer'], queryFn: () => answer }).data ?? 'asking'}</p>
      ),
      start: () => undefined,
    },
    {
      work: 'mutation',
      Component: ({ answer }: { answer: Promise<string> }) => {
        const { mutate, data } = useMutation({ mutationFn: () => answer });
        return (
          <button type="button" onClick={() => mutate()}>
            {data ?? 'asking'}
          </button>
        );
      },
      start: () => fireEvent.click(screen.getByRole('button')),
    },
  ])('waits for a $work the test left running', async ({ Component, start }) => {
    const answer = deferred();
    renderWith(<Component answer={answer.promise} />);
    start();

    const settled = settle();
    answer.resolve('answered');
    await settled;

    expect(screen.getByText('answered')).toBeInTheDocument();
  });

  it('names what is still running when it never ends', async () => {
    function Never() {
      const { data } = useQuery({
        queryKey: ['never'],
        queryFn: () => new Promise<string>(() => undefined),
      });
      return <p>{data}</p>;
    }
    renderWith(<Never />);

    await expect(settle(50)).rejects.toThrow('still running: query ["never"]');
  });

  it('throws LeakedUpdateError, naming the test, at a React update after the test ended', () => {
    let setLater: (value: string) => void = () => undefined;
    function Later() {
      const [value, set] = useState('before');
      setLater = set;
      return <p>{value}</p>;
    }
    render(<Later />);

    endUpdates('the leaking test');
    try {
      expect(() => setLater('after')).toThrow(new LeakedUpdateError('the leaking test'));
    } finally {
      startUpdates();
    }
  });
});
