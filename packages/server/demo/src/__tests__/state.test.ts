import { mediaPath, readState, statePath, summarizeSeed, writeState } from '../state';
import { fakeHost, optionsFrom } from './fake-host';

const REPORT = {
  steps: [
    { scenario: 'users', status: 'done' as const, detail: '12' },
    { scenario: 'live', status: 'skipped' as const, detail: 'full only' },
  ],
};

describe('demo: state', () => {
  it('keeps the state and the media cache under the work dir', () => {
    const options = optionsFrom();
    expect(statePath(options)).toBe('.demo/state.json');
    expect(mediaPath(options)).toBe('.demo/media');
  });

  it('reads nothing when there is no state', () => {
    expect(readState(fakeHost().host, optionsFrom())).toEqual({ ok: true, value: undefined });
  });

  it('writes the state and reads it back, keeping the first start and the last seed', () => {
    const { host, files } = fakeHost();
    const options = optionsFrom();
    const first = writeState(host, options, undefined, REPORT);
    const read = readState(host, options);
    expect(read).toEqual({ ok: true, value: first });
    const second = writeState(host, options, first, undefined);
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.seed).toEqual(REPORT);
    expect(files.get('.demo/state.json')).toContain('"version": 1');
  });

  it.each([
    { text: '{nope', error: 'is not JSON' },
    { text: '{"version":2}', error: 'is from another version' },
  ])('refuses $text', ({ text, error }) => {
    const read = readState(fakeHost({ files: { '.demo/state.json': text } }).host, optionsFrom());
    expect(read.ok ? '' : read.error).toContain(error);
  });

  it('counts the seed steps', () => {
    expect(summarizeSeed(REPORT)).toBe('1 done, 1 skipped, 0 failed of 2 seed steps');
  });
});
