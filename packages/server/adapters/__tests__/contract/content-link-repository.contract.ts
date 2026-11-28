import { expectOk } from '@kit/testing/result';
import type { ContentLinkRepositoryPort } from '@vp/core/repositories';
import { type ContentLink, type ContentRef, contentRefKey, NO_ANCHORS } from '@vp/domain';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  seedOwners,
  VIDEO_IDS,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b, c } = VIDEO_IDS;
const PLAYLIST_ID = '00000000-0000-7000-8000-0000000000a1';
const video = (id: string): ContentRef => ({ type: 'video', id });
const NOW = new Date('2026-11-01T10:00:00Z');

let sequence = 0;
function link(overrides: Partial<ContentLink> = {}): ContentLink {
  sequence += 1;
  return {
    id: `00000000-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
    source: video(a),
    target: video(b),
    params: { relation: 'related' },
    anchors: NO_ANCHORS,
    status: 'active',
    sourceChannelId: OWNER_CHANNEL_ID,
    targetChannelId: OWNER_CHANNEL_ID,
    createdBy: OWNER_ID,
    decidedBy: null,
    createdAt: new Date(NOW.getTime() + sequence * 1000),
    ...overrides,
  };
}

export function describeContentLinkRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ContentLinkRepository contract', () => {
    let subject: RepositoriesSubject;
    let links: ContentLinkRepositoryPort;

    const insert = async (overrides: Partial<ContentLink> = {}) => {
      const stored = expectOk(await links.insert(link(overrides)));
      if (!stored) throw new Error('the link was refused');
      return stored;
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      links = subject.repositories.contentLinks;
    });

    it('stores a link with its anchors and finds it by id and by edge', async () => {
      const anchors = {
        sourceStartMs: 1000,
        sourceEndMs: 2000,
        targetStartMs: 5000,
        targetEndMs: null,
      };
      const stored = await insert({ params: { relation: 'recap' }, anchors });

      expect(expectOk(await links.findById(stored.id))).toEqual(stored);
      expect(expectOk(await links.findByEdge(video(a), video(b), 'recap'))).toEqual(stored);
      expect(expectOk(await links.findByEdge(video(a), video(b), 'related'))).toBeNull();
      expect(stored.anchors).toEqual(anchors);
    });

    it('keeps an episode as its playlist and video', async () => {
      const episode: ContentRef = { type: 'episode', playlistId: PLAYLIST_ID, videoId: b };
      const stored = await insert({
        source: video(a),
        target: episode,
        params: { relation: 'full_video' },
      });

      expect(stored.target).toEqual(episode);
      expect(expectOk(await links.findByEdge(video(a), episode, 'full_video'))).toEqual(stored);
    });

    it.each([
      { scenario: 'active', status: 'active' as const },
      { scenario: 'declined', status: 'declined' as const },
    ])(
      'answers null for a second row on the same edge when the first is $scenario',
      async ({ status }) => {
        await insert({ status });

        expect(expectOk(await links.insert(link()))).toBeNull();
      }
    );

    it('moves a link only out of the statuses named', async () => {
      const pending = await insert({ status: 'pending' });

      expect(
        expectOk(await links.transition(pending.id, ['active'], 'declined', OWNER_ID))
      ).toBeNull();
      const approved = expectOk(
        await links.transition(pending.id, ['pending'], 'active', OTHER_OWNER_ID)
      );

      expect(approved).toMatchObject({ status: 'active', decidedBy: OTHER_OWNER_ID });
      expect(
        expectOk(await links.transition(pending.id, ['pending'], 'declined', OWNER_ID))
      ).toBeNull();
    });

    it('removes a link once', async () => {
      const stored = await insert();

      expect(expectOk(await links.remove(stored.id))).toBe(true);
      expect(expectOk(await links.remove(stored.id))).toBe(false);
      expect(expectOk(await links.findById(stored.id))).toBeNull();
    });

    it('reads the active links of every ref in both directions and nothing else', async () => {
      const outgoing = await insert({ source: video(a), target: video(b) });
      const incoming = await insert({
        source: video(c),
        target: video(a),
        params: { relation: 'recap' },
      });
      await insert({ source: video(a), target: video(c), status: 'pending' });
      await insert({ source: video(b), target: video(c), params: { relation: 'discussion' } });

      const touching = expectOk(await links.touching([video(a)]));

      expect(touching.map(({ direction, link: found }) => [direction, found.id])).toEqual(
        expect.arrayContaining([
          ['outgoing', outgoing.id],
          ['incoming', incoming.id],
        ])
      );
      expect(touching).toHaveLength(2);
      expect(touching.every(({ ref }) => contentRefKey(ref) === contentRefKey(video(a)))).toBe(
        true
      );
    });

    it('reads a link from both of its ends when both were asked for', async () => {
      await insert({ source: video(a), target: video(b) });

      const touching = expectOk(await links.touching([video(a), video(b)]));

      expect(touching.map(({ direction }) => direction).sort()).toEqual(['incoming', 'outgoing']);
    });

    it('reads nothing for no refs', async () => {
      expect(expectOk(await links.touching([]))).toEqual([]);
    });

    it('counts the active and pending links against the source and its channel', async () => {
      await insert({ target: video(b) });
      await insert({ target: video(c), status: 'pending' });
      await insert({ target: video(b), params: { relation: 'recap' }, status: 'declined' });
      await insert({ source: video(b), target: video(c) });

      expect(expectOk(await links.countOutgoing(video(a)))).toBe(2);
      expect(expectOk(await links.countForChannel(OWNER_CHANNEL_ID))).toBe(3);
      expect(expectOk(await links.countForChannel(OTHER_OWNER_CHANNEL_ID))).toBe(0);
    });

    it('lists a channel its chain edges of one relation', async () => {
      await insert({ source: video(a), target: video(b), params: { relation: 'previous' } });
      await insert({ source: video(a), target: video(c), params: { relation: 'previous' } });
      await insert({ source: video(b), target: video(c), params: { relation: 'follow_up' } });

      const edges = expectOk(await links.chainEdges(OWNER_CHANNEL_ID, 'previous'));

      expect(edges.get(contentRefKey(video(a)))?.sort()).toEqual(
        [contentRefKey(video(b)), contentRefKey(video(c))].sort()
      );
      expect(edges.size).toBe(1);
    });

    it('lists the queue of the target channel newest first within the statuses asked for', async () => {
      const first = await insert({ targetChannelId: OTHER_OWNER_CHANNEL_ID, status: 'pending' });
      const second = await insert({
        target: video(c),
        targetChannelId: OTHER_OWNER_CHANNEL_ID,
        status: 'pending',
      });
      await insert({ target: video(c), params: { relation: 'recap' }, status: 'pending' });

      const queue = expectOk(
        await links.listByTargetChannel(OTHER_OWNER_CHANNEL_ID, ['pending'], 10)
      );
      const bySource = expectOk(await links.listBySourceChannel(OWNER_CHANNEL_ID, ['pending'], 2));

      expect(queue.map(({ id }) => id)).toEqual([second.id, first.id]);
      expect(bySource).toHaveLength(2);
    });

    it('marks every link into a target broken and reports how many changed', async () => {
      const inbound = await insert({ source: video(a), target: video(c) });
      await insert({
        source: video(b),
        target: video(c),
        params: { relation: 'recap' },
        status: 'pending',
      });
      await insert({ source: video(a), target: video(b), params: { relation: 'recap' } });

      expect(expectOk(await links.markTargetBroken(video(c)))).toBe(2);
      expect(expectOk(await links.markTargetBroken(video(c)))).toBe(0);
      expect(expectOk(await links.findById(inbound.id))?.status).toBe('broken');
    });

    it('counts what a viewer suggested since a time, leaving their accepted links out', async () => {
      await insert({ createdBy: OTHER_OWNER_ID, status: 'suggested' });
      await insert({ createdBy: OTHER_OWNER_ID, target: video(c), status: 'declined' });
      await insert({
        createdBy: OTHER_OWNER_ID,
        source: video(c),
        target: video(a),
        status: 'active',
      });
      await insert({
        createdBy: OWNER_ID,
        source: video(b),
        target: video(a),
        status: 'suggested',
      });

      expect(expectOk(await links.countSuggestedBy(OTHER_OWNER_ID, new Date(NOW.getTime())))).toBe(
        2
      );
      expect(
        expectOk(await links.countSuggestedBy(OTHER_OWNER_ID, new Date(NOW.getTime() + 3_600_000)))
      ).toBe(0);
    });

    it('answers approve for a channel with no policy and keeps the one it was given', async () => {
      expect(expectOk(await links.linkPolicy(OWNER_CHANNEL_ID))).toBe('approve');

      expectOk(await links.setLinkPolicy(OWNER_CHANNEL_ID, 'block'));
      expectOk(await links.setLinkPolicy(OWNER_CHANNEL_ID, 'allow'));

      expect(expectOk(await links.linkPolicy(OWNER_CHANNEL_ID))).toBe('allow');
      expect(expectOk(await links.linkPolicy(OTHER_OWNER_CHANNEL_ID))).toBe('approve');
    });
  });
}
