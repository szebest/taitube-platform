import { renderHook } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { usePartyWatchingLine } from '../use-party-watching-line';

const lineOf = (watching: { names: string[]; count: number }) =>
  renderHook(usePartyWatchingLine, { wrapper: AppProviders }).result.current(watching);

describe('apps/client/web: usePartyWatchingLine', () => {
  it.each([
    { case: 'an empty room', watching: { names: [], count: 0 }, line: null },
    { case: 'one person', watching: { names: ['Ana'], count: 1 }, line: 'Ana is watching' },
    {
      case: 'two people',
      watching: { names: ['Ana', 'Tom'], count: 2 },
      line: 'Ana and Tom are watching',
    },
    {
      case: 'more people than names',
      watching: { names: ['Ana', 'Tom'], count: 5 },
      line: 'Ana, Tom, and 3 others are watching',
    },
    {
      case: 'one name left over',
      watching: { names: ['Ana'], count: 2 },
      line: 'Ana and 1 other are watching',
    },
  ])('writes $case', ({ watching, line }) => {
    expect(lineOf(watching)).toBe(line);
  });
});
