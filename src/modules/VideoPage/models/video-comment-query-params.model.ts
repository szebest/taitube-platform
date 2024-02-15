import { PaginatedQueryParams } from "src/models";

export type VideoCommentQueryParams = PaginatedQueryParams & { videoId: number };