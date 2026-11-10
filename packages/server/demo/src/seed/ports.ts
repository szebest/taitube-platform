import type { Result } from '@vp/result';
import type { SeedFailure } from './failure';
import type { RouteIndex } from './openapi-routes';

export type FetchPort = (url: string, init?: RequestInit) => Promise<Response>;

interface FilesPort {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<Uint8Array>;
}

interface ClockPort {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface UploadRequest {
  token: string;
  filePath: string;
  title: string;
  contentType: string;
  onProgress: (completed: number, total: number) => void;
}

export interface UploaderPort {
  upload(request: UploadRequest): Promise<Result<{ videoId: string }, SeedFailure>>;
}

export interface IdentityRow {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  role: 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
}

/** Everything the seed touches outside its own memory; tests hand it fakes. */
export interface SeedPorts {
  fetch: FetchPort;
  files: FilesPort;
  clock: ClockPort;
  uploader: UploaderPort;
  runFfmpeg(args: readonly string[]): Promise<Result<void, SeedFailure>>;
  writeIdentities(rows: readonly IdentityRow[]): Promise<Result<number, SeedFailure>>;
  contractRoutes(): Promise<Result<RouteIndex, SeedFailure>>;
  /** Where a finished video's HLS master is served, or null when the host has no CDN. */
  cdnBaseUrl: string | null;
  signToken(sub: string, role: string): string;
}
