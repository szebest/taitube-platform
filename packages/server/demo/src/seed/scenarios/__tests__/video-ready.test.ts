import { createFakeApi } from '../../__tests__/fake-api';
import { runScenariosOnFake } from '../../__tests__/fake-seed';

describe('seed/scenarios: video-ready', () => {
  it('logs the pipeline progress while it waits and ends when every video is READY', async () => {
    const { lines, all } = await runScenariosOnFake([]);

    expect(lines.filter((line) => line.includes('waiting for the pipeline'))).toEqual([
      '  waiting for the pipeline: 6 processing',
      '  waiting for the pipeline: 6 ready',
    ]);
    expect(all.find((step) => step.scenario === 'videos')?.status).toBe('done');
  });

  it('fails the videos step, with where they got stuck, when the pipeline never finishes', async () => {
    const { all } = await runScenariosOnFake([], createFakeApi({ stuck: true }));

    const videos = all.find((step) => step.scenario === 'videos');
    expect(videos?.status).toBe('failed');
    expect(videos?.detail).toContain('not every video settled within 15 minutes (6 processing)');
  });

  it('approves a video screening holds, as the admin, and waits for it to be READY', async () => {
    const api = createFakeApi({ hold: 2 });

    const { all, lines } = await runScenariosOnFake([], api);

    expect(lines.filter((line) => line.includes('screening held'))).toHaveLength(2);
    expect(all.find((step) => step.scenario === 'videos')?.status).toBe('done');
    expect([...api.state.videos.values()].every((video) => video.status === 'READY')).toBe(true);
  });

  it('reports a held video it cannot approve instead of waiting for it', async () => {
    const api = createFakeApi({ hold: 1, disabled: ['POST /v1/admin/videos'] });

    const { all } = await runScenariosOnFake([], api);

    const videos = all.find((step) => step.scenario === 'videos');
    expect(videos?.status).toBe('failed');
    expect(videos?.detail).toMatch(/1 videos did not reach READY: v\d+ HELD/);
  });
});
