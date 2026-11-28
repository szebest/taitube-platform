import { libraryVideo, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { activity } from '#app/features/library/__tests__/playlist-people';
import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { activitySentence } from '../activity-sentence';

const { items } = playlistDetail(uuid(1), [libraryVideo(1, 'Tram ride')]);
const ITEM = items[0]?.id ?? '';
const ANA = uuid(8001);
const GONE = {
  itemId: uuid(5999),
  videoId: uuid(99),
  title: null,
  addedBy: null,
  note: null,
  startMs: null,
  endMs: null,
};

const sentenceOf = (entry: ReturnType<typeof activity>) =>
  activitySentence(entry, items, translatorFor('en').tOr);

describe('apps/client/web: activitySentence', () => {
  it.each([
    {
      entry: activity(1, 'item_added', { itemId: ITEM, videoId: uuid(1) }),
      sentence: 'Ana added Tram ride',
    },
    { entry: activity(2, 'item_removed', GONE), sentence: 'Ana removed a video' },
    {
      entry: activity(3, 'item_removed', { ...GONE, videoId: null, title: 'Day two' }),
      sentence: 'Ana removed Day two',
    },
    {
      entry: activity(4, 'auto_removed', { ...GONE, videoId: uuid(1) }),
      sentence: 'Tram ride left the list once it was watched',
    },
    { entry: activity(5, 'items_reordered', { count: 3 }), sentence: 'Ana moved 3 videos' },
    {
      entry: activity(6, 'note_edited', { itemId: ITEM }),
      sentence: 'Ana edited the note on Tram ride',
    },
    {
      entry: activity(7, 'section_added', { itemId: uuid(5100), title: 'Day one' }),
      sentence: 'Ana added the section Day one',
    },
    {
      entry: activity(8, 'collaborator_added', { userId: ANA, role: 'editor' }),
      sentence: 'Ana joined as an editor',
    },
    {
      entry: activity(9, 'collaborator_added', { userId: uuid(8002), role: 'contributor' }),
      sentence: 'Ana added someone as a contributor',
    },
    {
      entry: activity(10, 'collaborator_removed', { userId: ANA }),
      sentence: 'Ana left the playlist',
    },
    {
      entry: activity(11, 'collaborator_removed', { userId: uuid(8002) }),
      sentence: 'Ana removed a collaborator',
    },
    {
      entry: activity(12, 'role_changed', { userId: uuid(8002), role: 'contributor' }),
      sentence: 'Ana made a collaborator a contributor',
    },
    {
      entry: activity(13, 'settings_changed', { fields: ['title'] }),
      sentence: 'Ana changed the settings',
    },
    {
      entry: activity(14, 'restored', { activityId: uuid(9102), itemId: ITEM }),
      sentence: 'Ana restored Tram ride',
    },
    {
      entry: activity(15, 'items_reordered', { count: 1 }, null),
      sentence: 'Someone moved 1 video',
    },
  ])('says "$sentence"', ({ entry, sentence }) => {
    expect(sentenceOf(entry)).toBe(sentence);
  });
});
