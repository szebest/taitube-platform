import type { contentLinks } from '@vp/db';
import type { ContentLink } from '@vp/domain';
import { fromStoredRef, toStoredRef } from '@vp/domain';

type ContentLinkRow = typeof contentLinks.$inferSelect;

export function linkFromRow(row: ContentLinkRow): ContentLink {
  return {
    id: row.id,
    source: fromStoredRef({ type: row.sourceType, id: row.sourceId, auxId: row.sourceAuxId }),
    target: fromStoredRef({ type: row.targetType, id: row.targetId, auxId: row.targetAuxId }),
    params: row.params,
    anchors: {
      sourceStartMs: row.sourceStartMs,
      sourceEndMs: row.sourceEndMs,
      targetStartMs: row.targetStartMs,
      targetEndMs: row.targetEndMs,
    },
    status: row.status,
    sourceChannelId: row.sourceChannelId,
    targetChannelId: row.targetChannelId,
    origin: row.origin,
    createdBy: row.createdBy,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt,
  };
}

export function linkToRow(link: ContentLink): ContentLinkRow {
  const source = toStoredRef(link.source);
  const target = toStoredRef(link.target);
  return {
    id: link.id,
    sourceType: source.type,
    sourceId: source.id,
    sourceAuxId: source.auxId,
    targetType: target.type,
    targetId: target.id,
    targetAuxId: target.auxId,
    relation: link.params.relation,
    params: link.params,
    ...link.anchors,
    status: link.status,
    sourceChannelId: link.sourceChannelId,
    targetChannelId: link.targetChannelId,
    origin: link.origin,
    createdBy: link.createdBy,
    decidedBy: link.decidedBy,
    createdAt: link.createdAt,
  };
}
