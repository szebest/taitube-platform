import { expectErr, expectOk } from '@kit/testing/result';
import {
  type LayoutReferenceScope,
  decideLayoutReferences,
  layoutReferences,
} from '../layout-references.rule';
import { contentSection, customTab, layoutWith, layoutWithHomeSections } from './layout-fixtures';

const CHANNEL = '0195a1b2-0000-7000-8000-000000000001';
const OWNER = '0195a1b2-0000-7000-8000-000000000002';
const VIDEO = '0195a1b2-0000-7000-8000-0000000000a1';
const PLAYLIST = '0195a1b2-0000-7000-8000-0000000000b1';
const POST = '0195a1b2-0000-7000-8000-0000000000c1';
const HEADER = '0195a1b2-0000-7000-8000-0000000000e1';
const BACKGROUND = '0195a1b2-0000-7000-8000-0000000000e2';
const INLINE = '0195a1b2-0000-7000-8000-0000000000e3';
const OTHER_CHANNEL = '0195a1b2-0000-7000-8000-0000000000d1';

const picked = layoutWithHomeSections(
  contentSection('picked', {
    source: {
      type: 'picked',
      items: [
        { kind: 'video', id: VIDEO },
        { kind: 'post', id: POST },
      ],
    },
    sort: 'manual',
  }),
  contentSection('series', { source: { type: 'playlist', playlistId: PLAYLIST } })
);

const scope = (facts: LayoutReferenceScope['facts']): LayoutReferenceScope => ({
  channelId: CHANNEL,
  ownerUserId: OWNER,
  facts,
});

const OWN = [
  { kind: 'video', id: VIDEO, channelId: CHANNEL, ownerUserId: OWNER },
  { kind: 'post', id: POST, channelId: CHANNEL, ownerUserId: null },
  { kind: 'playlist', id: PLAYLIST, channelId: null, ownerUserId: OWNER },
] as const;

describe('@vp/domain-rules: decideLayoutReferences', () => {
  it('names each video, post and playlist the document uses, once', () => {
    expect(layoutReferences(picked).map(({ kind }) => kind)).toEqual(['video', 'post', 'playlist']);
  });

  it('lets references that are the channel own through', () => {
    expectOk(decideLayoutReferences(picked, scope(OWN)));
  });

  it.each([
    { scenario: 'a video that is gone or private', facts: OWN.slice(1), kind: 'video', id: VIDEO },
    {
      scenario: 'a video of another channel',
      facts: [{ ...OWN[0], channelId: OTHER_CHANNEL }, ...OWN.slice(1)],
      kind: 'video',
      id: VIDEO,
    },
    {
      scenario: 'a playlist of another account',
      facts: [...OWN.slice(0, 2), { ...OWN[2], ownerUserId: OTHER_CHANNEL }],
      kind: 'playlist',
      id: PLAYLIST,
    },
  ])('refuses $scenario', ({ facts, kind, id }) => {
    expect(expectErr(decideLayoutReferences(picked, scope(facts)))).toMatchObject({
      code: 'LAYOUT_REFERENCE_INVALID',
      kind,
      id,
    });
  });

  it('names the page images a header, a background and a rich text use, and holds them to the channel', () => {
    const background = contentSection('lead');
    const layout = layoutWith({
      ...customTab('shows', 'shows', [
        {
          ...background,
          presentation: { ...background.presentation, background: BACKGROUND },
        },
        {
          kind: 'rich_text',
          id: 'about',
          body: `![Cast](page-image:${INLINE})`,
          presentation: background.presentation,
          visibility: background.visibility,
        },
      ]),
      header: HEADER,
    });
    const fact = (id: string) => ({
      kind: 'page-image' as const,
      id,
      channelId: CHANNEL,
      ownerUserId: null,
    });
    const facts = [HEADER, BACKGROUND, INLINE].map(fact);
    const BACKGROUND_FACT = fact(BACKGROUND);

    expect(layoutReferences(layout).map(({ id }) => id)).toEqual([HEADER, BACKGROUND, INLINE]);
    expectOk(decideLayoutReferences(layout, scope(facts)));
    expect(
      expectErr(
        decideLayoutReferences(
          layout,
          scope([...facts.slice(0, 1), { ...BACKGROUND_FACT, channelId: OTHER_CHANNEL }])
        )
      )
    ).toMatchObject({ code: 'LAYOUT_REFERENCE_INVALID', kind: 'page-image', id: BACKGROUND });
  });
});
