import type { FeedResponse, Problem, Video } from '@vp/api-contracts';
import type { paths } from '@vp/api-contracts/openapi';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Json<P extends keyof paths, M extends Method, S extends number> = NonNullable<
  paths[P][M]
> extends { responses: Record<S, { content: infer C }> }
  ? C[keyof C]
  : never;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

const _video: Equal<Json<'/v1/videos/{id}', 'get', 200>, Video> = true;
const _feed: Equal<Json<'/v1/feed', 'get', 200>, FeedResponse> = true;
type VideoNotFound = Json<'/v1/videos/{id}', 'get', 404>;

const _problem: VideoNotFound extends Problem ? true : false = true;
const _code: Equal<VideoNotFound['code'], 'VIDEO_NOT_FOUND'> = true;
const _params: Equal<paths['/v1/videos/{id}']['get']['parameters']['path'], { id: string }> = true;
