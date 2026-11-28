import { create } from 'qrcode';

const QUIET_ZONE = 2;

export interface PartyQrProps {
  link: string;
  label: string;
}

/** The link as a QR code, drawn here as one SVG path: nothing is fetched, and the code is always dark on light so a phone reads it. */
export function PartyQr({ link, label }: PartyQrProps) {
  const { modules } = create(link, { errorCorrectionLevel: 'M' });
  const side = modules.size + QUIET_ZONE * 2;
  const squares: string[] = [];

  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) {
        squares.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      className="size-40 shrink-0 rounded-thumb bg-on-media text-media"
    >
      <path d={squares.join('')} fill="currentColor" />
    </svg>
  );
}
