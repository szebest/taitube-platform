import { fetchSegments } from '../fetch-segments';

const urls = ['https://cdn/a.ts', 'https://cdn/b.ts', 'https://cdn/c.ts'];

function answering(answers: Array<Response | Error>): typeof fetch {
  const queue = [...answers];
  return vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next ?? new Response(null, { status: 404 });
  });
}

describe('apps/client/web: fetchSegments', () => {
  it.each([
    {
      name: 'fetches every segment within the budget',
      answers: [new Response('aaa'), new Response('bbb'), new Response('ccc')],
      budget: 100,
      count: 3,
    },
    {
      name: 'stops before the segment that would pass the budget',
      answers: [new Response('aaa'), new Response('bbb'), new Response('ccc')],
      budget: 7,
      count: 2,
    },
    {
      name: 'stops at a segment the server refuses',
      answers: [new Response('aaa'), new Response(null, { status: 404 })],
      budget: 100,
      count: 1,
    },
    {
      name: 'stops at a network failure',
      answers: [new Response('aaa'), new Error('offline')],
      budget: 100,
      count: 1,
    },
  ])('$name', async ({ answers, budget, count }) => {
    const fetched = await fetchSegments(answering(answers), urls, budget);

    expect(fetched.map(({ url }) => url)).toEqual(urls.slice(0, count));
  });
});
