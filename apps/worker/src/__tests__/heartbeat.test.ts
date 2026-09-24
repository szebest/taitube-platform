import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { type Every, Heartbeat, everyInterval } from '../heartbeat';
import { manualInterval } from './manual-interval';

const INTERVAL_MS = 15_000;

describe('apps/worker: Heartbeat', () => {
  let dir: string;
  let file: string;
  let clockMs: number;

  const heartbeat = (every: Every = manualInterval().every) =>
    new Heartbeat({ path: file, intervalMs: INTERVAL_MS, now: () => clockMs, every });
  const written = () => fs.readFile(file, 'utf8');

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-heartbeat-'));
    file = path.join(dir, 'nested', 'heartbeat');
    clockMs = 1_700_000_000_500;
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes integer epoch seconds and a newline, creating the directory', async () => {
    expect((await heartbeat().beat()).ok).toBe(true);

    expect(await written()).toBe('1700000000\n');
  });

  it('writes on start and again on every tick, in the same format, until stopped', async () => {
    const interval = manualInterval();
    const beating = heartbeat(interval.every);

    expect((await beating.start()).ok).toBe(true);
    expect(await written()).toBe('1700000000\n');

    clockMs += INTERVAL_MS;
    await interval.advance();
    expect(await written()).toBe('1700000015\n');

    beating.stop();
    expect(interval.ticks).toEqual([]);
  });

  it('refuses to start when the first beat cannot be written', async () => {
    await fs.writeFile(path.join(dir, 'nested'), 'a file where the directory should be');
    const interval = manualInterval();

    expect((await heartbeat(interval.every).start()).ok).toBe(false);
    expect(interval.ticks).toEqual([]);
  });

  it('schedules a real interval that stops cleanly', () => {
    expect(() => everyInterval(INTERVAL_MS, async () => {}).stop()).not.toThrow();
  });
});
