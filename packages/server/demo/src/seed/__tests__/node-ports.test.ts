import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyToken } from '@vp/dev-token';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  aliasingFetch,
  createNodePorts,
  createUploader,
  failureFromUpload,
  runProcess,
} from '../node-ports';
import { SMALL } from './fake-seed';

const quiet = { log: () => {} };

describe('seed/node-ports: runProcess', () => {
  it('succeeds when the process exits 0', async () => {
    expectOk(await runProcess(process.execPath, ['-e', 'process.exit(0)']));
  });

  it('reports a non-zero exit with the end of its stderr', async () => {
    const failure = expectErr(
      await runProcess(process.execPath, ['-e', 'console.error("bad input"); process.exit(3)'])
    );

    expect(failure.kind).toBe('process');
    expect(failure).toMatchObject({ message: expect.stringContaining('exited 3: bad input') });
  });

  it('reports a binary that is not there', async () => {
    expect(expectErr(await runProcess('definitely-not-a-binary', []))).toMatchObject({
      kind: 'process',
      message: expect.stringContaining('could not start'),
    });
  });
});

describe('seed/node-ports: failureFromUpload', () => {
  it.each([
    { message: 'initUpload failed (429): slow down', expected: { kind: 'http', status: 429 } },
    { message: 'Single upload failed: Bad Gateway', expected: { kind: 'invalid' } },
  ])('reads "$message"', ({ message, expected }) => {
    expect(failureFromUpload(message)).toMatchObject(expected);
  });
});

describe('seed/node-ports: aliasingFetch', () => {
  it('reaches a signed host through the alias and keeps the signed Host header', async () => {
    const server = createServer((request, response) => {
      response.end(`${request.headers.host}|${request.url}`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const answer = await aliasingFetch({ 'signed.test:9000': `127.0.0.1:${port}` })(
      'http://signed.test:9000/raw/x?sig=1'
    ).then((response) => response.text());
    server.close();

    expect(answer).toBe('signed.test:9000|/raw/x?sig=1');
  });
});

describe('seed/node-ports: createUploader', () => {
  it('reports an unreadable file as a failure, not a throw', async () => {
    const uploader = createUploader('http://127.0.0.1:9', async () => new Response());

    const failure = expectErr(
      await uploader.upload({
        token: 't',
        filePath: '/definitely/not/here.mp4',
        title: 'x',
        contentType: 'video/mp4',
        onProgress: () => {},
      })
    );

    expect(failure.kind).toBe('invalid');
  });

  it('starts a single upload, puts the bytes where the API says and completes it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'seed-upload-'));
    const file = join(dir, 'clip.mp4');
    await writeFile(file, new Uint8Array([1, 2, 3, 4]));
    const api = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        request.url === '/v1/uploads'
          ? JSON.stringify({
              videoId: 'v',
              uploadId: 'u',
              strategy: 'single',
              singleUrl: 'http://store/put',
              headers: { 'x-a': '1' },
              expiresAt: 'x',
            })
          : JSON.stringify({ videoId: 'v-done', status: 'UPLOADED' })
      );
    });
    await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
    const put = vi.fn(async () => new Response(null, { status: 200 }));

    const uploaded = await createUploader(
      `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
      put
    ).upload({
      token: 't',
      filePath: file,
      title: 'Clip',
      contentType: 'video/mp4',
      onProgress: () => {},
    });
    api.close();

    expect(expectOk(uploaded)).toEqual({ videoId: 'v-done' });
    expect(put).toHaveBeenCalledWith(
      'http://store/put',
      expect.objectContaining({ method: 'PUT', headers: { 'x-a': '1' } })
    );
  });
});

describe('seed/node-ports: createNodePorts', () => {
  it('reads the committed contract and knows its routes', async () => {
    const ports = createNodePorts(SMALL, quiet);

    const routes = expectOk(await ports.contractRoutes());

    expect(routes.has('POST /v1/uploads')).toBe(true);
    expect(routes.has('GET /v1/not-a-route')).toBe(false);
  });

  it('signs dev tokens for the persona it is given', () => {
    const ports = createNodePorts(SMALL, quiet);

    expect(
      verifyToken(ports.signToken('00000000-0000-7000-8000-00000000000b', 'moderator'))
    ).toMatchObject({
      sub: '00000000-0000-7000-8000-00000000000b',
      role: 'moderator',
    });
  });

  it('checks, creates and reads files through the file system', async () => {
    const { files } = createNodePorts(SMALL, quiet);
    const dir = await mkdtemp(join(tmpdir(), 'seed-ports-'));
    const nested = join(dir, 'a', 'b');

    await files.mkdir(nested);
    await writeFile(join(nested, 'x.bin'), new Uint8Array([1, 2, 3]));

    expect(await files.exists(join(nested, 'x.bin'))).toBe(true);
    expect(await files.exists(join(nested, 'y.bin'))).toBe(false);
    expect(Array.from(await files.read(join(nested, 'x.bin')))).toEqual([1, 2, 3]);
  });

  it('keeps time and sleeps for real', async () => {
    const { clock } = createNodePorts(SMALL, quiet);
    const before = clock.now();

    await clock.sleep(5);

    expect(clock.now()).toBeGreaterThanOrEqual(before + 4);
  });

  it('refuses to write identities without a database url', async () => {
    const ports = createNodePorts(SMALL, quiet);

    expect(expectErr(await ports.writeIdentities([]))).toMatchObject({ kind: 'database' });
  });

  it('hands the cdn url through', () => {
    expect(createNodePorts(SMALL, { ...quiet, cdnBaseUrl: 'http://cdn' }).cdnBaseUrl).toBe(
      'http://cdn'
    );
    expect(createNodePorts(SMALL, quiet).cdnBaseUrl).toBeNull();
  });
});
