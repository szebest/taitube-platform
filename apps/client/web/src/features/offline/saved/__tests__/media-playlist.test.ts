import { segmentUris, truncatePlaylist } from '../media-playlist';
import { MEDIA_PLAYLIST } from './saved-fixtures';

describe('apps/client/web: media playlist', () => {
  it('lists the segment URIs and nothing else', () => {
    expect(segmentUris(MEDIA_PLAYLIST)).toEqual(['seg_00000.ts', 'seg_00001.ts', 'seg_00002.ts']);
  });

  it.each([
    {
      name: 'blank lines and CRLF line ends',
      text: '#EXTM3U\r\n\r\na.ts\r\n \r\nb.ts\r\n',
      uris: ['a.ts', 'b.ts'],
    },
    { name: 'a playlist with no segments', text: '#EXTM3U\n#EXT-X-ENDLIST\n', uris: [] },
  ])('reads $name', ({ text, uris }) => {
    expect(segmentUris(text)).toEqual(uris);
  });

  it('cuts after the kept segment and closes the playlist once', () => {
    expect(truncatePlaylist(MEDIA_PLAYLIST, 2)).toBe(
      [
        '#EXTM3U',
        '#EXT-X-TARGETDURATION:10',
        '#EXTINF:10.0,',
        'seg_00000.ts',
        '#EXTINF:10.0,',
        'seg_00001.ts',
        '#EXT-X-ENDLIST',
        '',
      ].join('\n')
    );
  });

  it('keeps every segment of a playlist shorter than the cut, with one end tag', () => {
    const kept = truncatePlaylist(MEDIA_PLAYLIST, 9);

    expect(segmentUris(kept)).toHaveLength(3);
    expect(kept.match(/#EXT-X-ENDLIST/g)).toHaveLength(1);
  });
});
