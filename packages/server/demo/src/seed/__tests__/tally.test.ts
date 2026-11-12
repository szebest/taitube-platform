import { createTally } from '../tally';

const MISSING = { kind: 'http', method: 'GET', path: '/v1/x', status: 404, message: 'no' } as const;
const BROKEN = {
  kind: 'http',
  method: 'POST',
  path: '/v1/y',
  status: 500,
  message: 'boom',
} as const;

describe('seed/tally: createTally', () => {
  it('counts what it made and what was already there', () => {
    const tally = createTally();
    tally.created(2);
    tally.existing();

    expect(tally.outcome('comments')).toEqual({
      status: 'done',
      detail: '2 comments created, 1 already there',
    });
  });

  it('fails the step on a failure and says how many more there were', () => {
    const tally = createTally();
    tally.created();
    tally.fail(BROKEN);
    tally.fail(BROKEN);

    expect(tally.outcome('likes')).toEqual({
      status: 'failed',
      detail: '1 likes created, 0 already there; POST /v1/y answered 500: boom (+1 more)',
    });
  });

  it('skips the step when the only thing it met was a route that is not in this build', () => {
    const tally = createTally();
    tally.fail(MISSING);

    expect(tally.outcome('x')).toEqual({
      status: 'skipped',
      detail: 'needs GET /v1/x (not in this build)',
    });
  });

  it('keeps the work it did and notes a route it had to leave out', () => {
    const tally = createTally();
    tally.created();
    tally.skipped('no CDN');

    expect(tally.outcome('x')).toEqual({
      status: 'done',
      detail: '1 x created, 0 already there; no CDN',
    });
  });
});
