import { dt } from '../define';

export const player = {
  play: dt('Play'),
  pause: dt('Pause'),
  mute: dt('Mute'),
  unmute: dt('Unmute'),
  volume: dt('Volume'),
  seek: dt('Seek'),
  settings: dt('Settings'),
  quality: dt('Quality'),
  autoQuality: dt('Auto'),
  autoQualityAt: dt('Auto ({height:number}p)', { number: { height: { useGrouping: false } } }),
  speed: dt('Playback speed'),
  normalSpeed: dt('Normal'),
  rate: dt('{rate:number}x'),
  fullscreen: dt('Full screen'),
  exitFullscreen: dt('Exit full screen'),
} as const;
