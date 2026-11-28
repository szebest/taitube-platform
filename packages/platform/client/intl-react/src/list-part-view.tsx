import type { ListDetail } from '@kit/intl';
import { type Align, MoreDisclosure, type Side } from '@kit/ui';
import type { ReactNode } from 'react';

/**
 * How the "and N more" of a list opens its items; any field left out keeps the default.
 * @public
 */
export interface MoreTooltip {
  readonly trigger?: (more: string) => ReactNode;
  readonly content?: (detail: ListDetail) => ReactNode;
  readonly side?: Side;
  readonly align?: Align;
  readonly openDelay?: number;
}

export interface ListPartViewProps {
  readonly detail: ListDetail;
  /** `false` renders the text alone. */
  readonly moreTooltip?: false | MoreTooltip;
}

function AllItems({ detail }: { detail: ListDetail }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {[...detail.visible, ...detail.hidden].map((item) => (
        <li key={item}>
          <bdi>{item}</bdi>
        </li>
      ))}
    </ul>
  );
}

/** A list as segments: items isolated for their own direction, the "more" as a disclosure. */
export function ListPartView({ detail, moreTooltip }: ListPartViewProps) {
  if (moreTooltip === false) return <>{detail.text}</>;

  const { trigger, content, ...placement } = moreTooltip ?? {};

  return (
    <>
      {detail.segments.map(({ type, value }) => {
        if (type === 'literal') return value;
        if (type === 'item') return <bdi key={`item:`}>{value}</bdi>;
        return (
          <MoreDisclosure
            key={type}
            content={content?.(detail) ?? <AllItems detail={detail} />}
            {...placement}
          >
            {trigger?.(value) ?? value}
          </MoreDisclosure>
        );
      })}
    </>
  );
}
