import { renderHook } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';
import type { PropsWithChildren } from 'react';
import type { PlayerCaptionTrack } from '#app/features/player/player-port';
import { useCaptionTrackLabel } from '../use-caption-track-label';

function renderLabel(locale: string) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <IntlProvider locale={locale} timeZone="UTC">
      {children}
    </IntlProvider>
  );
  return renderHook(() => useCaptionTrackLabel(), { wrapper }).result.current;
}

describe('apps/client/web: useCaptionTrackLabel', () => {
  it.each<{ locale: string; track: Pick<PlayerCaptionTrack, 'language' | 'kind'>; label: string }>([
    { locale: 'en', track: { language: 'pl', kind: 'uploaded' }, label: 'Polish' },
    { locale: 'en', track: { language: 'pt-BR', kind: 'edited' }, label: 'Brazilian Portuguese' },
    { locale: 'en', track: { language: 'en', kind: 'auto' }, label: 'English (auto-generated)' },
    { locale: 'en', track: { language: null, kind: 'auto' }, label: 'Auto-generated' },
    { locale: 'pl', track: { language: 'en', kind: 'uploaded' }, label: 'angielski' },
  ])('names $track.language $track.kind as "$label" in $locale', ({ locale, track, label }) => {
    expect(renderLabel(locale)(track)).toBe(label);
  });
});
