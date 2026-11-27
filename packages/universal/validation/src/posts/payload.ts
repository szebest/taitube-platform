import { type Result, andThen, assertNever, err, map, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import {
  type InvalidPostPayload,
  invalidPostImageCount,
  invalidPostStartMs,
  invalidPostText,
} from './failures';

const TEXT_BOUNDS: LengthBounds = { minLength: 1, maxLength: 2000 };
const CAPTION_BOUNDS: LengthBounds = { minLength: 0, maxLength: 2000 };
const ALT_BOUNDS: LengthBounds = { minLength: 1, maxLength: 200 };
const COMMENT_BOUNDS: LengthBounds = { minLength: 0, maxLength: 500 };
const IMAGE_COUNT = { minItems: 1, maxItems: 4 } as const;

export interface PostImageInput {
  readonly uploadId: string;
  readonly alt: string;
}

export type PostPayloadInput =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'images';
      readonly images: PostImageInput[];
      readonly caption: string | null;
    }
  | {
      readonly kind: 'video_share';
      readonly videoId: string;
      readonly comment: string | null;
      readonly startMs: number | null;
    }
  | {
      readonly kind: 'playlist_share';
      readonly playlistId: string;
      readonly comment: string | null;
    };

function required(
  field: string,
  value: string,
  bounds: LengthBounds
): Result<string, InvalidPostPayload> {
  const text = normalizePlainText(value);
  return withinLength(text, bounds) ? ok(text) : err(invalidPostText(field, bounds));
}

function optionalText(
  field: string,
  value: string | null,
  bounds: LengthBounds
): Result<string | null, InvalidPostPayload> {
  if (value === null) return ok(null);
  return map(required(field, value, { ...bounds, minLength: 0 }), (text) => text || null);
}

function images(list: PostImageInput[]): Result<PostImageInput[], InvalidPostPayload> {
  if (list.length < IMAGE_COUNT.minItems || list.length > IMAGE_COUNT.maxItems) {
    return err(invalidPostImageCount(IMAGE_COUNT));
  }
  const checked: PostImageInput[] = [];
  for (const [index, image] of list.entries()) {
    const alt = required(`images.${index}.alt`, image.alt, ALT_BOUNDS);
    if (!alt.ok) return alt;
    checked.push({ uploadId: image.uploadId, alt: alt.value });
  }
  return ok(checked);
}

function startMs(value: number | null): Result<number | null, InvalidPostPayload> {
  if (value === null) return ok(null);
  return Number.isInteger(value) && value >= 0 ? ok(value) : err(invalidPostStartMs());
}

/** Normalizes every text of a post and returns the payload to store; an empty optional text becomes `null`. */
export function validatePostPayload(
  payload: PostPayloadInput
): Result<PostPayloadInput, InvalidPostPayload> {
  switch (payload.kind) {
    case 'text':
      return map(required('text', payload.text, TEXT_BOUNDS), (text) => ({ ...payload, text }));
    case 'images':
      return andThen(images(payload.images), (checked) =>
        map(optionalText('caption', payload.caption, CAPTION_BOUNDS), (caption) => ({
          ...payload,
          images: checked,
          caption,
        }))
      );
    case 'video_share':
      return andThen(optionalText('comment', payload.comment, COMMENT_BOUNDS), (comment) =>
        map(startMs(payload.startMs), (start) => ({ ...payload, comment, startMs: start }))
      );
    case 'playlist_share':
      return map(optionalText('comment', payload.comment, COMMENT_BOUNDS), (comment) => ({
        ...payload,
        comment,
      }));
    default:
      return assertNever(payload, 'PostPayload');
  }
}
