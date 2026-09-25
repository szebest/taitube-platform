import { renderToStaticMarkup } from 'react-dom/server';
import {
  type KeysetArgs,
  type KeysetQueryHook,
  type KeysetPage,
  useInfiniteScroll,
} from '../useInfiniteScroll';

type Feed = { nextCursor: string | null; isFetching: boolean };

const FIRST_PAGE: KeysetArgs = { limit: 2 };

function keysetQuery(feed: Feed, asked: KeysetArgs[]): KeysetQueryHook<KeysetPage, KeysetArgs> {
  return (args) => {
    asked.push(args);
    return {
      data: { nextCursor: feed.nextCursor },
      isFetching: feed.isFetching,
      isLoading: false,
      isError: false,
      refetch: () => {},
    };
  };
}

/** Asks for one more page while rendering, which a server render applies before it returns. */
function ScrolledOnce({ useFeedQuery }: { useFeedQuery: KeysetQueryHook<KeysetPage, KeysetArgs> }) {
  const { loadMore, query } = useInfiniteScroll(useFeedQuery, FIRST_PAGE);
  if (query.cursor === undefined) loadMore();
  return <span>{query.cursor ?? 'first page'}</span>;
}

function scrollOnce(feed: Feed): { markup: string; asked: KeysetArgs[] } {
  const asked: KeysetArgs[] = [];
  const markup = renderToStaticMarkup(<ScrolledOnce useFeedQuery={keysetQuery(feed, asked)} />);
  return { markup, asked };
}

describe('apps/web: infinite scroll', () => {
  it('asks for the page after the cursor the last page returned', () => {
    const { markup, asked } = scrollOnce({ nextCursor: 'page-2', isFetching: false });

    expect(markup).toContain('page-2');
    expect(asked).toEqual([{ limit: 2 }, { limit: 2, cursor: 'page-2' }]);
  });

  it.each<{ scenario: string; feed: Feed }>([
    { scenario: 'a page is still loading', feed: { nextCursor: 'page-2', isFetching: true } },
    { scenario: 'the feed has no next page', feed: { nextCursor: null, isFetching: false } },
  ])('stays on the first page while $scenario', ({ feed }) => {
    const { markup, asked } = scrollOnce(feed);

    expect(markup).toContain('first page');
    expect(asked).toEqual([{ limit: 2 }]);
  });
});
