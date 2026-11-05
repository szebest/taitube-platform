import { ACCENT_GROUNDS, deriveAccent, type ModeFamily } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';

const FAMILIES: readonly ModeFamily[] = ['dark', 'light'];

type PreviewProps = { hex: string };

function FamilyPreview({ hex, family }: PreviewProps & { family: ModeFamily }) {
  const { tOr } = useT();
  const derived = deriveAccent(hex, family);
  if (!derived.ok) return null;

  const { accent, onAccent, accentInk, accentSoft } = derived.value;
  return (
    <li
      data-family={family}
      className="tw:flex tw:flex-col tw:gap-inline tw:rounded-control tw:p-inset-control"
      style={{ backgroundColor: ACCENT_GROUNDS[family] }}
    >
      <span className="tw:text-caption" style={{ color: accentInk }}>
        {family === 'dark'
          ? tOr('studio.brandPreviewDark', {}, '')
          : tOr('studio.brandPreviewLight', {}, '')}
      </span>
      <span
        className="tw:rounded-control tw:px-3 tw:py-1 tw:text-label"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        {accent}
      </span>
      <span
        className="tw:rounded-control tw:px-3 tw:py-1 tw:text-label"
        style={{ backgroundColor: accentSoft, color: accentInk }}
      >
        {accentInk}
      </span>
    </li>
  );
}

/** What the engine derives from the colour on a dark and on a light page, before it is saved. */
export function BrandAccentPreview({ hex }: PreviewProps) {
  return (
    <ul className="tw:m-0 tw:flex tw:list-none tw:flex-wrap tw:gap-inline tw:p-0">
      {FAMILIES.map((family) => (
        <FamilyPreview key={family} hex={hex} family={family} />
      ))}
    </ul>
  );
}
