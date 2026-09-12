import { PaginatedQueryParams } from "src/models";

export type VideosQueryParams = {
  searchText: string | undefined;
  categoryId: number | undefined;
} & PaginatedQueryParams;