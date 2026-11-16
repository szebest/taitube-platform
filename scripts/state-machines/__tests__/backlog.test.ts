import { BACKLOG } from '../backlog';

describe('scripts: state-machines/backlog', () => {
  it('gives every item a distinct id', () => {
    const ids = BACKLOG.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes plain ASCII, so the generated document needs no encoding care', () => {
    const text = BACKLOG.map((item) => `${item.id}${item.title}${item.why}`).join('');

    expect(text).toMatch(/^[\x20-\x7e]*$/);
  });
});
