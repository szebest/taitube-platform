import { expectOk } from '@kit/testing/result';
import type { ListChannelPostsOptions } from '@vp/core/repositories';
import type { ChannelPostCursor, ChannelPostEntry } from '@vp/domain';
import {
  type ChannelPostContractContext,
  POST_AT,
  POST_IDS,
  postInput,
  publishPost,
} from './channel-post-contract-context';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  idsOf,
} from './fixtures';
import { AS, SUBSCRIBER_ID } from './subscriber-fixtures';

const FIRST_PAGE: ListChannelPostsOptions = { viewerId: null, cursor: null, limit: 10 };

const postIds = (entries: readonly ChannelPostEntry[]) => idsOf(entries.map((entry) => entry.post));

function cursorAfter(entries: readonly ChannelPostEntry[]): ChannelPostCursor {
  const post = entries[0]?.post;
  if (!post?.publishedAt) throw new Error('a listed post is published');
  return { pinnedAt: post.pinnedAt, publishedAt: post.publishedAt, id: post.id };
}

export function describeChannelPostListingContract(ctx: ChannelPostContractContext): void {
  describe('channel post listings', () => {
    const published = async () => {
      await publishPost(ctx, POST_IDS.a);
      await publishPost(ctx, POST_IDS.b);
      await publishPost(ctx, POST_IDS.c);
      await ctx.subject.placePost(POST_IDS.a, { publishedAt: POST_AT.old });
      await ctx.subject.placePost(POST_IDS.b, { publishedAt: POST_AT.mid });
      await ctx.subject.placePost(POST_IDS.c, { publishedAt: POST_AT.new });
    };

    const channelPage = async (options: Partial<ListChannelPostsOptions> = {}) =>
      expectOk(await ctx.posts.listPublished(OWNER_CHANNEL_ID, { ...FIRST_PAGE, ...options }));

    const feedPage = async (options: Partial<ListChannelPostsOptions> = {}) =>
      expectOk(await ctx.posts.listFeed(AS, { ...FIRST_PAGE, ...options }));

    it('lists newest first, and the pinned post ahead of them', async () => {
      await published();
      expect(postIds(await channelPage())).toEqual([POST_IDS.c, POST_IDS.b, POST_IDS.a]);

      await ctx.subject.placePost(POST_IDS.a, { pinnedAt: POST_AT.pin });

      expect(postIds(await channelPage())).toEqual([POST_IDS.a, POST_IDS.c, POST_IDS.b]);
    });

    it('breaks a shared publish time on the id, highest first', async () => {
      await published();
      await ctx.subject.placePost(POST_IDS.a, { publishedAt: POST_AT.new });
      await ctx.subject.placePost(POST_IDS.b, { publishedAt: POST_AT.new });

      expect(postIds(await channelPage())).toEqual([POST_IDS.c, POST_IDS.b, POST_IDS.a]);
    });

    it('returns one row past the limit and walks the pages by the cursor of the last row kept', async () => {
      await published();
      await ctx.subject.placePost(POST_IDS.a, { pinnedAt: POST_AT.pin });

      const first = await channelPage({ limit: 1 });
      const second = await channelPage({ limit: 1, cursor: cursorAfter(first) });
      const last = await channelPage({ limit: 1, cursor: cursorAfter(second) });

      expect(postIds(first)).toEqual([POST_IDS.a, POST_IDS.c]);
      expect(postIds(second)).toEqual([POST_IDS.c, POST_IDS.b]);
      expect(postIds(last)).toEqual([POST_IDS.b]);
    });

    it('leaves out drafts and the posts of other channels', async () => {
      await published();
      await ctx.subject.seedDraftPost(postInput(POST_IDS.draft));
      await publishPost(ctx, POST_IDS.other, OTHER_OWNER_CHANNEL_ID);

      expect(postIds(await channelPage())).toEqual([POST_IDS.c, POST_IDS.b, POST_IDS.a]);
    });

    it.each([
      { viewer: 'a viewer who liked it', viewerId: OTHER_OWNER_ID, liked: [true, false] },
      { viewer: 'another viewer', viewerId: OWNER_ID, liked: [false, false] },
      { viewer: 'an anonymous viewer', viewerId: null, liked: [false, false] },
    ])('reports likedByViewer for $viewer', async ({ viewerId, liked }) => {
      await published();
      expectOk(await ctx.posts.setLiked(POST_IDS.c, OTHER_OWNER_ID, true));

      const entries = await channelPage({ viewerId });

      expect(entries.slice(0, 2).map((entry) => entry.likedByViewer)).toEqual(liked);
      expect(entries[0]?.post.likeCount).toBe(1);
    });

    it('lists the feed from the posts of subscribed channels only, newest first', async () => {
      await published();
      await publishPost(ctx, POST_IDS.other, OTHER_OWNER_CHANNEL_ID);
      await ctx.subject.placePost(POST_IDS.other, { publishedAt: POST_AT.pin });
      await ctx.subject.repositories.subscriptions.subscribe(SUBSCRIBER_ID, AS, OWNER_CHANNEL_ID);
      await ctx.subject.placePost(POST_IDS.a, { pinnedAt: POST_AT.pin });

      expect(postIds(await feedPage())).toEqual([POST_IDS.c, POST_IDS.b, POST_IDS.a]);
      expect(postIds(await feedPage({ limit: 1 }))).toEqual([POST_IDS.c, POST_IDS.b]);
    });

    it('lists nothing in the feed for a channel that subscribes to none', async () => {
      await published();

      expect(await feedPage()).toEqual([]);
    });

    it('likes a post once however often it is asked, and unliking never goes below zero', async () => {
      await publishPost(ctx, POST_IDS.a);
      const set = async (liked: boolean) =>
        expectOk(await ctx.posts.setLiked(POST_IDS.a, OTHER_OWNER_ID, liked));
      const isLiked = async () => expectOk(await ctx.posts.isLiked(POST_IDS.a, OTHER_OWNER_ID));

      expect(await set(true)).toEqual({ liked: true, likeCount: 1 });
      expect(await set(true)).toEqual({ liked: true, likeCount: 1 });
      expect(await isLiked()).toBe(true);
      expect(await set(false)).toEqual({ liked: false, likeCount: 0 });
      expect(await set(false)).toEqual({ liked: false, likeCount: 0 });
      expect(await isLiked()).toBe(false);
      expect(expectOk(await ctx.posts.findById(POST_IDS.a))?.likeCount).toBe(0);
    });

    it('counts the likes of different users together', async () => {
      await publishPost(ctx, POST_IDS.a);

      expectOk(await ctx.posts.setLiked(POST_IDS.a, OTHER_OWNER_ID, true));

      expect(expectOk(await ctx.posts.setLiked(POST_IDS.a, OWNER_ID, true))).toEqual({
        liked: true,
        likeCount: 2,
      });
    });

    it('answers null for a like on a post that is not there', async () => {
      expect(expectOk(await ctx.posts.setLiked(POST_IDS.missing, OWNER_ID, true))).toBeNull();
      expect(expectOk(await ctx.posts.isLiked(POST_IDS.missing, OWNER_ID))).toBe(false);
    });
  });
}
