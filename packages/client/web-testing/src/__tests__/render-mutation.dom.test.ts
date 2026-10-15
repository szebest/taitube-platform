import { QueryClient, useMutation } from '@tanstack/react-query';

import { heldReply, runMutation } from '../render-mutation';

function echoHook(answer: (word: string) => Promise<string>) {
  return function useEcho() {
    return useMutation({ mutationFn: answer });
  };
}

describe('@vp/web-testing: runMutation', () => {
  it.each([
    { outcome: 'fulfilled', answer: async (word: string) => word, settled: { value: 'hi' } },
    {
      outcome: 'rejected',
      answer: async () => Promise.reject(new Error('refused')),
      settled: { reason: new Error('refused') },
    },
  ])('settles a $outcome mutation instead of throwing', async ({ outcome, answer, settled }) => {
    const result = await runMutation(new QueryClient(), echoHook(answer), 'hi');

    expect(result).toEqual({ status: outcome, ...settled });
  });
});

describe('@vp/web-testing: heldReply', () => {
  it('answers only once the spec releases it', async () => {
    const held = heldReply(() => 'late');
    let answered: string | undefined;
    const answering = held.answer().then((reply) => {
      answered = reply;
    });

    await Promise.resolve();
    expect(answered).toBeUndefined();

    held.release();
    await answering;
    expect(answered).toBe('late');
  });
});
