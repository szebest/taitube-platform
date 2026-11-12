import { type Result, ok } from '@vp/result';
import type { SeedFailure } from '../failure';
import { ALL_ROUTES, type RouteIndex } from '../openapi-routes';
import type { FetchPort, IdentityRow, SeedPorts, UploadRequest } from '../ports';

export interface FakePorts extends SeedPorts {
  ffmpegCalls: string[][];
  written: Set<string>;
  slept: number[];
  uploads: UploadRequest[];
  identityRows: IdentityRow[][];
}

export interface FakePortOptions {
  fetch?: FetchPort;
  routes?: RouteIndex;
  cdnBaseUrl?: string | null;
  upload?: (request: UploadRequest, index: number) => Result<{ videoId: string }, SeedFailure>;
}

const NO_FETCH: FetchPort = async () => {
  throw new Error('fetch was not expected');
};

export function createFakePorts(options: FakePortOptions = {}): FakePorts {
  let clock = 1_000_000;
  const ports: FakePorts = {
    ffmpegCalls: [],
    written: new Set(),
    slept: [],
    uploads: [],
    identityRows: [],
    fetch: options.fetch ?? NO_FETCH,
    files: {
      exists: async (path) => ports.written.has(path),
      mkdir: async () => {},
      read: async () => new Uint8Array([137, 80, 78, 71]),
    },
    clock: {
      now: () => clock,
      sleep: async (ms) => {
        ports.slept.push(ms);
        clock += ms;
      },
    },
    uploader: {
      upload: async (request) => {
        ports.uploads.push(request);
        return (
          options.upload?.(request, ports.uploads.length - 1) ??
          ok({
            videoId: `00000000-0000-7000-9000-${String(ports.uploads.length).padStart(12, '0')}`,
          })
        );
      },
    },
    runFfmpeg: async (args) => {
      ports.ffmpegCalls.push([...args]);
      ports.written.add(args[args.length - 1] ?? '');
      return ok(undefined);
    },
    writeIdentities: async (rows) => {
      ports.identityRows.push([...rows]);
      return ok(rows.length);
    },
    contractRoutes: async () => ok(options.routes ?? ALL_ROUTES),
    cdnBaseUrl: options.cdnBaseUrl === undefined ? 'http://cdn.test/public' : options.cdnBaseUrl,
    signToken: (sub, role) => `token:${role}:${sub}`,
  };
  return ports;
}
