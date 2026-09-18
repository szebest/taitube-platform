import type { ListPublicVideosOptions, ListPublicVideosResult, VideoRecord } from '@vp/core/ports';

/**
 * Pure domain filtering, multi-sort, and keyset cursor slicing for public feed.
 */
export function filterAndSortPublicVideos(
  videos: Iterable<VideoRecord>,
  options: ListPublicVideosOptions
): ListPublicVideosResult {
  const { cursor, limit, sort = 'recent', categoryId } = options;

  let allPublic = Array.from(videos).filter((v) => {
    if (v.visibility !== 'public') return false;
    if (v.status !== 'READY') return false;
    if (v.deletedAt) return false;
    if (categoryId && v.categoryId !== categoryId) return false;
    return true;
  });

  const total = allPublic.length;

  const now = Date.now();
  const getGravityScore = (v: VideoRecord): number => {
    const ageHours = Math.max(0, (now - v.createdAt.getTime()) / 3600000);
    const views = v.viewsCount ?? 0;
    return (views + 1) / (ageHours + 2) ** 1.5;
  };

  if (sort === 'popular') {
    allPublic.sort((a, b) => {
      const va = a.viewsCount ?? 0;
      const vb = b.viewsCount ?? 0;
      if (vb !== va) return vb - va;
      return b.id.localeCompare(a.id);
    });
  } else if (sort === 'trending') {
    allPublic.sort((a, b) => {
      const sa = getGravityScore(a);
      const sb = getGravityScore(b);
      if (sb !== sa) return sb - sa;
      return b.id.localeCompare(a.id);
    });
  } else {
    allPublic.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });
  }

  if (cursor) {
    const targetViews = cursor.viewsCount;
    const targetScore = cursor.score;
    const targetDate = cursor.createdAt;

    if (sort === 'popular' && targetViews !== undefined) {
      allPublic = allPublic.filter((v) => {
        const vc = v.viewsCount ?? 0;
        return vc < targetViews || (vc === targetViews && v.id < cursor.id);
      });
    } else if (sort === 'trending' && targetScore !== undefined) {
      allPublic = allPublic.filter((v) => {
        const sc = getGravityScore(v);
        return sc < targetScore || (sc === targetScore && v.id < cursor.id);
      });
    } else if (targetDate) {
      const ct = targetDate.getTime();
      allPublic = allPublic.filter((v) => {
        const vt = v.createdAt.getTime();
        return vt < ct || (vt === ct && v.id < cursor.id);
      });
    }
  }

  const items = allPublic.slice(0, limit + 1);
  return { items, total };
}
