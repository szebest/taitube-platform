import { type Result, err, ok } from '@kit/result';
import { type ContentRefType, type LinkAnchors, hasTimeline } from '@vp/domain';
import { type LinkAnchorInvalid, linkAnchorInvalid } from './failures';

export interface AnchorSide {
  readonly type: ContentRefType;
  /** `null` when the side has no known length yet: only the shape of its anchors is checked. */
  readonly durationMs: number | null;
}

export interface LinkAnchorsInput {
  readonly anchors: LinkAnchors;
  readonly source: AnchorSide;
  readonly target: AnchorSide;
}

function sideValid(
  start: number | null,
  end: number | null,
  { type, durationMs }: AnchorSide
): boolean {
  if (start === null && end === null) return true;
  if (!hasTimeline(type) || start === null || start < 0) return false;
  if (end !== null && end <= start) return false;
  const last = end ?? start;
  return durationMs === null || last <= durationMs;
}

/** A timestamp links to a timestamp and a span to a span, only where there is a timeline. */
export function decideLinkAnchors(input: LinkAnchorsInput): Result<LinkAnchors, LinkAnchorInvalid> {
  const { anchors, source, target } = input;
  if (!sideValid(anchors.sourceStartMs, anchors.sourceEndMs, source)) {
    return err(linkAnchorInvalid('source'));
  }
  if (!sideValid(anchors.targetStartMs, anchors.targetEndMs, target)) {
    return err(linkAnchorInvalid('target'));
  }
  return ok(anchors);
}
