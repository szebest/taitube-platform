import { createFakeApi } from '../../__tests__/fake-api';
import { runScenariosOnFake, runTwice } from '../../__tests__/fake-seed';
import { captions } from '../captions';

describe('seed/scenarios: captions', () => {
  it('does its work once and finds it there on the next run', async () => {
    const { first, second } = await runTwice(captions);

    expect(first).toMatchObject({ scenario: 'captions', status: 'done' });
    expect(first?.detail).toMatch(/^(\d+) caption tracks created, 0 already there/);
    expect(second).toMatchObject({ scenario: 'captions', status: 'done' });
    expect(second?.detail).toMatch(/^0 caption tracks created, \d+ already there/);
  });

  it('uploads WebVTT with timed cues that end before the clip does', async () => {
    const api = createFakeApi();

    await runScenariosOnFake([captions], api);

    expect(api.vtt.length).toBeGreaterThan(0);
    for (const track of api.vtt) {
      expect(track.startsWith('WEBVTT\n\n1\n00:00:00.000 --> ')).toBe(true);
      expect(track.match(/-->/g)).toHaveLength(3);
    }
  });
});
