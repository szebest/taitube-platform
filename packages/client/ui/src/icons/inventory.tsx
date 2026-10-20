import {
  Bell,
  Bookmark,
  Captions,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Command,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Forward,
  Funnel,
  Globe,
  Heart,
  History,
  House,
  Info,
  ListFilter,
  ListPlus,
  ListVideo,
  Lock,
  Maximize,
  Maximize2,
  Menu,
  MessageSquare,
  Moon,
  PanelsTopLeft,
  Pause,
  PenLine,
  Pin,
  Play,
  Plus,
  Radio,
  RectangleHorizontal,
  Repeat,
  Scissors,
  Search,
  Settings,
  Shield,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  SquarePlay,
  Sun,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Tv,
  Upload,
  User,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';

type GlyphProps = ComponentProps<'svg'> & { strokeWidth?: number | string };

export type Glyph = ComponentType<GlyphProps>;

const SVG_DEFAULTS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const dots = (points: readonly (readonly [number, number])[], radius: number) =>
  function Dots(props: GlyphProps) {
    return (
      <svg {...SVG_DEFAULTS} aria-hidden="true" {...props}>
        {points.map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={radius}
            fill="currentColor"
            stroke="none"
          />
        ))}
      </svg>
    );
  };

function Verified(props: GlyphProps) {
  return (
    <svg {...SVG_DEFAULTS} aria-hidden="true" {...props}>
      <circle cx={12} cy={12} r={10} fill="currentColor" stroke="none" />
      <path d="m8 12 3 3 5-6" stroke="var(--bg)" strokeWidth={2.4} />
    </svg>
  );
}

/** The product's icon ids (docs/design/foundations/iconography.md), each drawn by one glyph. */
export const ICONS = {
  menu: Menu,
  search: Search,
  home: House,
  shorts: Smartphone,
  following: Tv,
  live: Radio,
  explore: Compass,
  you: User,
  history: History,
  clock: Clock,
  playlist: ListVideo,
  video: SquarePlay,
  plus: Plus,
  upload: Upload,
  bell: Bell,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  play: Play,
  pause: Pause,
  next: SkipForward,
  prev: SkipBack,
  volume: Volume2,
  captions: Captions,
  theater: RectangleHorizontal,
  fullscreen: Maximize,
  expand: Maximize2,
  like: ThumbsUp,
  dislike: ThumbsDown,
  share: Forward,
  save: Bookmark,
  'queue-add': ListPlus,
  clip: Scissors,
  more: dots(
    [
      [12, 5],
      [12, 12],
      [12, 19],
    ],
    1.4
  ),
  'more-h': dots(
    [
      [5, 12],
      [12, 12],
      [19, 12],
    ],
    1.4
  ),
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  check: Check,
  close: X,
  shuffle: Shuffle,
  repeat: Repeat,
  grip: dots(
    [
      [9, 6],
      [15, 6],
      [9, 12],
      [15, 12],
      [9, 18],
      [15, 18],
    ],
    1.2
  ),
  chat: MessageSquare,
  heart: Heart,
  pin: Pin,
  flame: Flame,
  chart: ChartLine,
  layout: PanelsTopLeft,
  shield: Shield,
  tag: Tag,
  eye: Eye,
  'eye-off': EyeOff,
  lock: Lock,
  globe: Globe,
  trash: Trash2,
  edit: PenLine,
  filter: Funnel,
  sort: ListFilter,
  'wifi-off': WifiOff,
  alert: TriangleAlert,
  info: Info,
  command: Command,
  verified: Verified,
} as const satisfies Record<string, Glyph>;

export type IconId = keyof typeof ICONS;

/** The directional ids, flipped under a right-to-left document; objects (play, clock) never are. */
export const MIRROR_IN_RTL: ReadonlySet<IconId> = new Set([
  'chevron-right',
  'chevron-left',
  'next',
  'prev',
  'share',
]);
