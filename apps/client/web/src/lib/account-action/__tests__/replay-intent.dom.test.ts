import {
  decodeIntent,
  encodeIntent,
  forgetIntent,
  intentIn,
  rawIntent,
  rememberIntent,
  takeIntent,
} from '../replay-intent';

const ID = '0190c3a0-5e1d-7000-8000-000000000007';
const HREF = '/watch/1?t=4';

describe('apps/client/web: replay intent', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it.each([
    { kind: 'like', id: ID },
    { kind: 'subscribe', id: ID },
    { kind: 'save', id: ID },
  ] as const)('carries a $kind through its encoded form', (intent) => {
    expect(decodeIntent(encodeIntent(intent))).toEqual(intent);
  });

  it.each([undefined, '', 'like', 'like:nope', `dislike:${ID}`, `report:${ID}`])(
    'reads %j as no intent',
    (raw) => {
      expect(decodeIntent(raw)).toBeUndefined();
    }
  );

  it('hands a remembered intent back once', () => {
    rememberIntent({ kind: 'like', id: ID }, HREF);

    expect(takeIntent(HREF)).toEqual({ kind: 'like', id: ID });
    expect(takeIntent(HREF)).toBeUndefined();
  });

  it.each(['/', '/watch/2?t=4', '/watch/1'])('keeps an intent from %s', (href) => {
    rememberIntent({ kind: 'like', id: ID }, HREF);

    expect(takeIntent(href)).toBeUndefined();
  });

  it('forgets an intent it was told to', () => {
    rememberIntent({ kind: 'save', id: ID }, HREF);
    forgetIntent();

    expect(takeIntent(HREF)).toBeUndefined();
  });

  it('lets an intent go stale after ten minutes', () => {
    vi.useFakeTimers();
    rememberIntent({ kind: 'subscribe', id: ID }, HREF);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(takeIntent(HREF)).toBeUndefined();
  });

  it('reads damaged storage as no intent', () => {
    window.sessionStorage.setItem('vp.replay', '{not json');

    expect(takeIntent(HREF)).toBeUndefined();
  });

  it('reads the intent in the text storage holds, without taking it', () => {
    rememberIntent({ kind: 'subscribe', id: ID }, HREF);

    expect(intentIn(rawIntent(), HREF)).toEqual({ kind: 'subscribe', id: ID });
    expect(intentIn(rawIntent(), HREF)).toEqual({ kind: 'subscribe', id: ID });
    expect(intentIn(null, HREF)).toBeUndefined();
  });
});
