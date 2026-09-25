import { NOW, contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { publishedAt } from '../published-at';

const THREE_DAYS_EARLIER = '2026-09-19T18:30:00.000Z';

describe('@vp/intl: publishedAt', () => {
  it('pairs a relative value with an absolute one', () => {
    expect(publishedAt(THREE_DAYS_EARLIER, NOW)).toEqual({
      relative: {
        type: 'relative',
        value: THREE_DAYS_EARLIER,
        now: NOW,
        options: { pastOnly: true },
      },
      absolute: { type: 'dateTime', value: THREE_DAYS_EARLIER },
    });
  });

  it('renders the text and the title beside it', () => {
    const intl = createIntl(contextFor('en-GB'));
    const { relative, absolute } = publishedAt(THREE_DAYS_EARLIER);

    const text = intl.format(relative);
    const title = intl.format(absolute);

    expect(text).toEqual({ ok: true, value: '3 days ago' });
    expect(title.ok && title.value).toMatch(/^19 Sept? 2026(,| at) 18:30$/);
  });

  it('says now, not in the future, for an instant the clock has not reached', () => {
    const intl = createIntl(contextFor('en'));
    const aMinuteAhead = new Date(Date.parse(NOW) + 60_000).toISOString();

    expect(intl.format(publishedAt(aMinuteAhead).relative)).toEqual({ ok: true, value: 'now' });
  });
});
