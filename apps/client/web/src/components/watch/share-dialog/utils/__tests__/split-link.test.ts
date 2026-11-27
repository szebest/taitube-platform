import { splitLink } from '../split-link';

describe('apps/client/web: splitLink', () => {
  it.each([
    {
      scenario: 'a link longer than the tail',
      link: 'https://taitube.example/watch/abc',
      head: 'https://taitube.example/w',
      tail: 'atch/abc',
    },
    { scenario: 'a link shorter than the tail', link: 'x.y', head: '', tail: 'x.y' },
  ])('splits $scenario at the tail length', ({ link, head, tail }) => {
    expect(splitLink(link, 8)).toEqual({ head, tail });
    expect(`${head}${tail}`).toBe(link);
  });
});
