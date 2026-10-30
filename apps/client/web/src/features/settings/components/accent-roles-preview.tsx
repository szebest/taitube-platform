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
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <p role="status" className="tw:m-0 tw:text-body-sm tw:text-fg-muted">
        {accent.toLowerCase() === hex.toLowerCase()
          ? tOr('settings.accentFits', {}, '')
          : tOr('settings.accentAdjusted', { hex: accent }, '')}
      </p>
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-wrap tw:gap-inline tw:p-0">
        {samples.map(({ role, background, foreground, ratio }) => (
          <li
            key={role}
            className="tw:flex tw:flex-col tw:gap-1 tw:rounded-control tw:border-divider tw:border-border tw:p-inset-control tw:text-caption tw:text-fg"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: background, color: foreground }}
              className="tw:rounded-xs tw:px-2 tw:py-1 tw:text-label"
            >
              Aa
            </span>
            <span>{tOr('settings.accentRole', { role }, '')}</span>
            <span className="tw:text-fg-muted">
              {tOr('settings.accentContrast', { ratio }, '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
