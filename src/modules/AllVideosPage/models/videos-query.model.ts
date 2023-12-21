import { PaginatedQueryParams } from "src/models";

export type VideosQueryParams = {
  searchText: string | undefined;
} & PaginatedQueryParams;