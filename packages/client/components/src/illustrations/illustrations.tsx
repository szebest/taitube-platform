import type { ComponentPropsWithRef } from 'react';

type IllustrationProps = ComponentPropsWithRef<'svg'>;

export function EmptyLibraryIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <path d="M24 136h192" />
        <rect x="70" y="22" width="116" height="72" rx="14" />
        <rect x="62" y="32" width="116" height="72" rx="14" />
      </g>
      <rect x="54" y="44" width="116" height="72" rx="14" stroke="currentColor" strokeWidth="3" />
      <path d="M68 102h88" stroke="currentColor" strokeWidth="3" opacity=".3" />
      <path d="M100 102a12 12 0 0 1 24 0z" fill="currentColor" opacity=".3" />
      <g stroke="currentColor" strokeWidth="3">
        <circle cx="178" cy="114" r="16" />
        <path d="M178 106v16M170 114h16" />
      </g>
    </svg>
  );
}

export function ErrorIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M24 136h192" stroke="currentColor" strokeWidth="3" opacity=".3" />
      <g transform="rotate(-6 120 80)">
        <rect x="62" y="40" width="116" height="72" rx="14" stroke="currentColor" strokeWidth="3" />
        <path d="m76 92 18-12 14 10 14-14 14 12 16-10 12 8" stroke="currentColor" strokeWidth="3" />
      </g>
      <path d="M108 136a12 12 0 0 1 24 0z" fill="currentColor" opacity=".3" />
      <g stroke="currentColor" strokeWidth="3">
        <path d="M190 30v18" />
        <path d="M190 58v.5" />
      </g>
    </svg>
  );
}

export function NoCommentsIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <path d="M24 136h192" />
        <path d="M110 26h82a14 14 0 0 1 14 14v30a14 14 0 0 1-14 14h-6v14l-16-14h-60a14 14 0 0 1-14-14V40a14 14 0 0 1 14-14z" />
      </g>
      <path
        d="M48 52h84a14 14 0 0 1 14 14v30a14 14 0 0 1-14 14H76l-16 14v-14h-12a14 14 0 0 1-14-14V66a14 14 0 0 1 14-14z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="M52 74h60M52 90h36" stroke="currentColor" strokeWidth="3" opacity=".3" />
    </svg>
  );
}

export function NoNotificationsIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <path d="M24 136h192" />
        <rect x="34" y="40" width="44" height="28" rx="6" />
        <rect x="162" y="56" width="44" height="28" rx="6" />
      </g>
      <g stroke="currentColor" strokeWidth="3">
        <path d="M90 110V86a30 30 0 0 1 60 0v24" />
        <path d="M80 110h80" />
        <path d="M112 122a8 8 0 0 0 16 0" />
      </g>
      <path
        d="M164 26h12l-12 14h12M184 14h8l-8 9h8"
        stroke="currentColor"
        strokeWidth="3"
        opacity=".3"
      />
    </svg>
  );
}

export function NoResultsIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <path d="M24 136h192" />
        <path d="M62 96h96" />
      </g>
      <rect x="48" y="28" width="124" height="80" rx="14" stroke="currentColor" strokeWidth="3" />
      <g stroke="currentColor" strokeWidth="3">
        <circle cx="158" cy="94" r="24" />
        <path d="m176 112 18 18" />
      </g>
      <path d="M150 94h16" stroke="currentColor" strokeWidth="3" opacity=".3" />
    </svg>
  );
}

export function NotFoundIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M24 136h192" stroke="currentColor" strokeWidth="3" opacity=".3" />
      <rect
        x="46"
        y="32"
        width="116"
        height="72"
        rx="14"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="10 9"
      />
      <path d="M60 90h88" stroke="currentColor" strokeWidth="3" opacity=".3" />
      <path d="M180 136a16 16 0 0 1 32 0z" fill="currentColor" />
      <path d="M128 122h24M136 114h12" stroke="currentColor" strokeWidth="3" opacity=".3" />
    </svg>
  );
}

export function OfflineIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <path d="M24 136h192" />
        <path d="M100 30a28 28 0 0 1 40 0M90 20a42 42 0 0 1 60 0" />
      </g>
      <rect x="62" y="44" width="116" height="72" rx="14" stroke="currentColor" strokeWidth="3" />
      <path d="M76 98h88" stroke="currentColor" strokeWidth="3" />
      <path d="M106 112a14 14 0 0 1 28 0z" fill="currentColor" opacity=".3" />
      <path d="M84 24 156 128" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function SignedOutIllustration(props: IllustrationProps) {
  return (
    <svg
      data-slot="illustration"
      viewBox="0 0 240 160"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M24 136h192" stroke="currentColor" strokeWidth="3" opacity=".3" />
      <rect x="62" y="34" width="116" height="80" rx="14" stroke="currentColor" strokeWidth="3" />
      <circle cx="120" cy="68" r="14" fill="currentColor" opacity=".3" />
      <path d="M96 114a24 24 0 0 1 48 0z" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="3" opacity=".3">
        <circle cx="196" cy="58" r="8" />
        <path d="M196 66v22M196 80h7" />
      </g>
    </svg>
  );
}
