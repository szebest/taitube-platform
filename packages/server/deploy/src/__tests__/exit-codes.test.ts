import { EXIT } from '../exit-codes';

describe('exit codes', () => {
  it('are the four the deploy scripts document, each distinct', () => {
    expect(EXIT).toEqual({ ok: 0, failure: 1, usage: 2, prerequisite: 3 });
  });
});
