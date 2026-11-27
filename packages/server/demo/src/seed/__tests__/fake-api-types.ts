interface Call {
  actor: { id: string; role: string } | null;
  params: Record<string, string>;
  query: URLSearchParams;
  json: RequestBody;
  text: string;
}

type Handler = (call: Call) => { status?: number; body?: unknown };

interface RequestBody {
  handle?: string;
  slug?: string;
  version?: number;
  content?: string;
  parentId?: string;
  type?: string;
  title?: string;
  videoId?: string;
  videoIds?: string[];
  trailerVideoId?: string;
}

export interface FakeChannel {
  id: string;
  ownerId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  brandColor: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  handleChangeAvailableAt: string | null;
}

export interface FakeVideo {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: string;
  status: string;
  categoryId: string | null;
  tags: string[];
  version: number;
  durationMs: number | undefined;
}

export interface FakeComment {
  id: string;
  videoId: string;
  parentId: string | null;
  content: string;
  isPinned: boolean;
  heartedByCreator: boolean;
  replyCount: number;
  author: { userId: string };
}

export const problem = (status: number, code: string) => ({ status, body: { code } });

export type Route = [method: string, pattern: string, handler: Handler];
