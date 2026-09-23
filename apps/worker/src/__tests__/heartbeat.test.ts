import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Heartbeat } from '../heartbeat';

const INTERVAL_MS = 15_000;

describe('apps/worker: Heartbeat', () => {
  let dir: string;
  let file: string;
  let clockMs: number;
  let heartbeat: Heartbeat;

  const written = () => fs.readFile(file, 'utf8');

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-heartbeat-'));
    file = path.join(dir, 'nested', 'heartbeat');
    clockMs = 1_700_000_000_500;
    heartbeat = new Heartbeat({ path: file, intervalMs: INTERVAL_MS, now: () => clockMs });
  });

  afterEach(async () => {
    heartbeat.stop();
    vi.useRealTimers();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes integer epoch seconds and a newline, creating the directory', async () => {
    expect((await heartbeat.beat()).ok).toBe(true);

    expect(await written()).toBe('1700000000\n');
  });

  it('writes on start and again on every interval, in the same format', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    expect((await heartbeat.start()).ok).toBe(true);
    expect(await written()).toMatch(/^\d+\n$/);

    clockMs += INTERVAL_MS;
    vi.advanceTimersByTime(INTERVAL_MS);

    await vi.waitFor(async () => expect(await written()).toBe('1700000015\n'));
  });

  it('refuses to start when the first beat cannot be written', async () => {
    await fs.writeFile(path.join(dir, 'nested'), 'a file where the directory should be');

    expect((await heartbeat.start()).ok).toBe(false);
  });
});
