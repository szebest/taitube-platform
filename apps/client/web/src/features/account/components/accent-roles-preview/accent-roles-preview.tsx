import { ACCENT_GROUNDS, compositeOver, contrastRatio, deriveAccent } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { useAppearance } from '@vp/ui';

interface RoleSample {
  role: 'accent' | 'accentHover' | 'accentSoft' | 'onAccent' | 'accentInk';
  background: string;
  foreground: string;
  ratio: number;
}

export type AccentRolesPreviewProps = { hex: string };

/**
 * The roles the engine derives from a colour, with the contrast each holds, on the ground the
 * viewer is looking at: what saving the colour would put on screen, before it does.
 */
export function AccentRolesPreview({ hex }: AccentRolesPreviewProps) {
  const { shownMode } = useAppearance();
  const { tOr } = useT();
  const family = shownMode === 'light' ? 'light' : 'dark';
  const derived = deriveAccent(hex, family);

  if (!derived.ok) return null;

  const { accent, accentHover, accentSoft, onAccent, accentInk } = derived.value;
  const ground = ACCENT_GROUNDS[family];
  const soft = unwrapOr(compositeOver(accentSoft, ground), ground);
  const samples: RoleSample[] = [
    {
      role: 'accent',
      background: accent,
      foreground: onAccent,
      ratio: contrastRatio(accent, ground),
    },
    {
      role: 'accentHover',
      background: accentHover,
      foreground: onAccent,
      ratio: contrastRatio(accentHover, ground),
    },
    {
      role: 'accentSoft',
      background: soft,
      foreground: accentInk,
      ratio: contrastRatio(accentInk, soft),
    },
    {
      role: 'onAccent',
      background: accent,
      foreground: onAccent,
      ratio: contrastRatio(onAccent, accent),
    },
    {
      role: 'accentInk',
      background: ground,
      foreground: accentInk,
      ratio: contrastRatio(accentInk, ground),
    },
  ];

  return (
    <div className="flex flex-col gap-inline">
      <p role="status" className="m-0 text-body-sm text-fg-muted">
        {accent.toLowerCase() === hex.toLowerCase()
          ? tOr('settings.accentFits', {}, '')
          : tOr('settings.accentAdjusted', { hex: accent }, '')}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
        {samples.map(({ role, background, foreground, ratio }) => (
          <li
            key={role}
            className="flex flex-col gap-1 rounded-control border-divider border-border p-inset-control text-caption text-fg"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: background, color: foreground }}
              className="rounded-xs px-2 py-1 text-label"
            >
              Aa
            </span>
            <span>{tOr('settings.accentRole', { role }, '')}</span>
            <span className="text-fg-muted">{tOr('settings.accentContrast', { ratio }, '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
