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
      className="flex flex-col gap-inline rounded-control p-inset-control"
      style={{ backgroundColor: ACCENT_GROUNDS[family] }}
    >
      <span className="text-caption" style={{ color: accentInk }}>
        {family === 'dark'
          ? tOr('studio.brandPreviewDark', {}, '')
          : tOr('studio.brandPreviewLight', {}, '')}
      </span>
      <span
        className="rounded-control px-3 py-1 text-label"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        {accent}
      </span>
      <span
        className="rounded-control px-3 py-1 text-label"
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
    <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
      {FAMILIES.map((family) => (
        <FamilyPreview key={family} hex={hex} family={family} />
      ))}
    </ul>
  );
}
