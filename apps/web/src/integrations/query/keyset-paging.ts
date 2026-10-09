export const KEYSET_PAGE_SIZE = 30;

type KeysetPage = { nextCursor: string | null };

const FIRST_PAGE: string | undefined = undefined;

export const keysetPaging = {
  initialPageParam: FIRST_PAGE,
  getNextPageParam: ({ nextCursor }: KeysetPage) => nextCursor ?? undefined,
};
