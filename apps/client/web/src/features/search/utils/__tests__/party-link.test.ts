import { PARTY_ID } from '@vp/web-testing';
import { parsePartyLink } from '../party-link';

describe('apps/client/web: parsePartyLink', () => {
  it.each([
    {
      case: 'a room link',
      text: `http://localhost:3000/parties/${PARTY_ID}`,
      found: { roomId: PARTY_ID },
    },
    {
      case: 'a room link with an invite, padded with spaces',
      text: `  http://localhost:3000/parties/${PARTY_ID}?invite=inv-1 `,
      found: { roomId: PARTY_ID, invite: 'inv-1' },
    },
    { case: 'a path alone', text: `/parties/${PARTY_ID}`, found: { roomId: PARTY_ID } },
    { case: 'a link to something else', text: 'http://localhost:3000/watch/abc', found: undefined },
    { case: 'a room id that is no id', text: '/parties/not-an-id', found: undefined },
    { case: 'plain words', text: 'movie night', found: undefined },
  ])('reads $case', ({ text, found }) => {
    expect(parsePartyLink(text)).toEqual(found);
  });
});
