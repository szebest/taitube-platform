export function Imperative() {
  // no-memo: the video.js handle is mutated in place, so a compiled read of it goes stale
  'use no memo';
  return null;
}
