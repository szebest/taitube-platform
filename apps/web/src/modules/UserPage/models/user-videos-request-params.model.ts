import { PaginatedQueryParams } from "src/models";

export type UserVideosRequestParams = {
  userId: number | undefined;
} & PaginatedQueryParams;