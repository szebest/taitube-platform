# 72: Extensive settings & customization system — themes, playback preferences, privacy toggles & channel branding

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 38 — User identity · 53 — Frontend architecture · 55 — Modern design system · 69 — Frontend URL-driven state |
| Blocks | 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

## What to build

A premier streaming platform must empower users and creators with granular control over their viewing and publishing experience: visual themes, playback defaults, privacy controls, notification preferences, and channel branding. Storing these settings in ad-hoc, untyped local storage causes configuration loss and inconsistent cross-device experiences.

This ticket delivers the **Extensive Settings & Customization System** (`/settings` and `?modal=settings&tab=...`):

1. **Tabbed Settings Hub (`/settings`) & Deep-Linked Settings Modal**:
   - URL-driven tab synchronization: `/settings?tab=appearance|playback|privacy|notifications|channel`.
   - Reusable quick-settings modal (`?modal=settings&tab=...`) accessible directly from user header avatar dropdown.

2. **Customization Categories & Features**:
   - **Appearance & Themes (`/settings?tab=appearance`)**:
     - Theme selector: `Dark (Obsidian)`, `Light (Clean)`, `OLED (Pure Pitch Black #000000)`, or `System Sync`.
     - Accent color customization: `Crimson Red (Default)`, `Neon Amber`, `Electric Violet`, `Cyber Cyan`.
     - Video Card Density: `Comfortable` (large cards, high details) vs `Compact` (denser grid for power users).
     - Ambient Lighting: Global default toggle (enable/disable ambient canvas glow).
   - **Playback & Player Defaults (`/settings?tab=playback`)**:
     - Default streaming quality: `Auto`, `1080p HD`, `720p`, `480p` (honored across video transitions).
     - Default playback speed: `1x`, `1.25x`, `1.5x`, `2x`.
     - Autoplay next video toggle: On / Off (controls playlist and Up Next auto-advance).
     - Inline video preview on hover toggle: On / Off.
     - Captions / Subtitles toggle: default language, caption font size (`Small`, `Medium`, `Large`), caption background opacity.
     - "Stats for Nerds" default toggle: On / Off.
   - **Privacy & History (`/settings?tab=privacy`)**:
     - "Pause Watch History": When enabled, viewing videos does not append entries to `watch_history` or record resume points.
     - "Clear All Watch History": Confirmation dialog triggering `DELETE /v1/me/history`.
     - Playlist default privacy: `Public`, `Unlisted`, or `Private`.
     - Subscriptions privacy: Keep subscriptions private / public on channel profile.
   - **Notifications & Audio Alerts (`/settings?tab=notifications`)**:
     - Subscribed channel upload alerts (In-app toasts, browser Web Push).
     - Activity on comments (replies, likes on comments).
     - Transcoding complete notification alerts.
   - **Channel Customization & Branding (`/settings?tab=channel`)** (Creator mode):
     - Display name and handle (`@handle`) editing with real-time uniqueness validation.
     - Avatar upload with client-side crop preview.
     - Channel banner image upload with desktop/tablet/mobile viewport safe-zone guides.
     - Channel description bio and external social links (GitHub, X, Discord, Website).

3. **Hybrid Durability Model (Local Storage + Cloud Profile Sync)**:
   - Client-only preferences (theme, card density, volume) persist immediately to typed `localStorage` schema with zero network lag.
   - User account preferences (privacy toggles, notifications, channel profile) synchronize to backend `PATCH /v1/me/preferences` and `PATCH /v1/me/profile`.

## Acceptance criteria

- [ ] Route `/settings` and deep-linked modal `?modal=settings&tab=...` implemented with TanStack Router.
- [ ] Appearance settings: Theme toggle (Dark, Light, OLED, System) and Accent color picker instantly update CSS variables without page reload.
- [ ] Card density selector switches video grid between comfortable and compact layouts.
- [ ] Playback settings: Default quality, playback speed, autoplay next, and hover preview toggles saved and respected by `<TaitubePlayer />`.
- [ ] Privacy settings:
  - "Pause Watch History" toggle stops `POST /v1/me/history` tracking.
  - "Clear Watch History" button successfully deletes all history records with confirmation modal.
- [ ] Channel branding form powered by `@tanstack/react-form` + `@tanstack/zod-form-adapter`:
  - Validates handle formatting (`^[a-zA-Z0-9_]{3,30}$`) and bio length.
  - Generates presigned avatar and banner upload URLs and previews images before submit.
- [ ] Notification preferences toggles wired with optimistic state updates.
- [ ] Component tests in `apps/web/src/__tests__/settings.integration.test.tsx` verifying theme switching, playback preference persistence, and form submission.

## Out of scope

- Email notification digest SMTP delivery.
- Custom domain mapping for channels.

## Notes for the implementer

- **Zero-Flash Theme Bootstrapping:** Ensure `theme-script.ts` reads initial theme from `localStorage` in the HTML `<head>` before hydration to prevent light/dark flicker.
- **File Length Discipline:** Modularize settings tabs into `apps/web/src/pages/settings/tabs/` (`AppearanceTab`, `PlaybackTab`, `PrivacyTab`, `ChannelTab`), keeping each under 200 lines.

## Testing plan

- Theme persistence test: Change theme to OLED -> reload page -> verify `html` element retains `theme-oled` class.
- Privacy test: Enable "Pause Watch History" -> watch a video -> assert history list remains unchanged.
- Channel branding test: Update handle and avatar -> assert updated channel profile displays new assets.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test`.
- [ ] Settings hub fully responsive across mobile and desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
