import { CATEGORIES, DESCRIPTION_TEMPLATES, TITLE_TEMPLATES } from './catalog';
import type { Rng } from './rng';
import type { ClipSource, UserSpec, VideoSpec } from './world-types';

const MIN_VIDEOS_FOR_NON_PUBLIC = 6;

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function visibilityFor(index: number, count: number): VideoSpec['visibility'] {
  if (count < MIN_VIDEOS_FOR_NON_PUBLIC) return 'public';
  if (index === count - 1) return 'private';
  if (index === count - 2) return 'unlisted';
  return 'public';
}

const CLIP_SOURCES = [
  'testsrc2',
  'gradients',
  'life',
  'mandelbrot',
  'cellauto',
  'smptebars',
  'rgbtestsrc',
] as const satisfies readonly ClipSource[];

/** Videos go round the owners; every owner has two topics, and about one video in four is a vertical Short. */
export function buildVideos(
  rng: Rng,
  owners: readonly UserSpec[],
  count: number,
  maxSeconds: number
): VideoSpec[] {
  if (owners.length === 0) return [];
  const topics = new Map(owners.map((owner) => [owner.id, rng.sample(CATEGORIES, 2)] as const));
  const titles = new Set<string>();
  const shortEvery = count >= 5 ? 4 : 0;

  return Array.from({ length: count }, (_, index): VideoSpec => {
    const owner = owners[index % owners.length] as UserSpec;
    const category = rng.pick((topics.get(owner.id) ?? CATEGORIES) as typeof CATEGORIES);
    const subject = rng.pick(category.subjects);
    let title = sentence(rng.pick(TITLE_TEMPLATES).replace('{subject}', subject));
    for (let part = 2; titles.has(`${owner.id}/${title}`); part++) {
      title = `${title} (part ${part})`;
    }
    titles.add(`${owner.id}/${title}`);

    return {
      key: `v${String(index + 1).padStart(2, '0')}`,
      ownerId: owner.id,
      title,
      description: sentence(rng.pick(DESCRIPTION_TEMPLATES).replace('{subject}', subject)),
      categorySlug: category.slug,
      tags: ['demo', ...rng.sample(category.tags, 2)],
      visibility: visibilityFor(index, count),
      shape: shortEvery > 0 && index % shortEvery === shortEvery - 1 ? 'short' : 'standard',
      seconds: rng.int(8, maxSeconds),
      source: rng.pick(CLIP_SOURCES),
      hue: (category.hue + rng.int(-20, 20) + 360) % 360,
      toneHz: 180 + rng.int(0, 20) * 20,
    };
  });
}
