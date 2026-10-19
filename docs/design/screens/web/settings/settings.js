// Shared behaviour for the settings screens: the shell, the settings index and search, and every control.
// Appearance goes through design.js (`TT.ready` -> update); everything else is device-only demo state in
// localStorage under its own key. Mirrors what ticket 72 builds on useAppearance and the preference store.
(async () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ICONS = '../../../lib/icons.svg';
  const page = document.body.dataset.page;

  const icon = (id, className = 'tt-icon') => `<svg class="${className}" aria-hidden="true"><use href="${ICONS}#${id}"/></svg>`;
  const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const label = (name) => kebab(name).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const html = (strings, ...values) => strings.reduce((out, part, i) => out + part + (values[i] ?? ''), '');
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const entries = (node) => Object.entries(node ?? {}).filter(([key]) => !key.startsWith('$'));
  let uid = 0;

  const SECTIONS = [
    { id: 'appearance', label: 'Appearance', icon: 'layout', href: 'appearance.html', text: 'Theme, mode, accent and density.' },
    { id: 'accessibility', label: 'Accessibility', icon: 'eye', href: 'accessibility.html', text: 'Text size, contrast, motion, borders and captions.' },
    { id: 'playback', label: 'Playback', icon: 'play', href: 'playback.html', text: 'Quality, speed, autoplay, previews and ambient mode.' },
    { id: 'privacy', label: 'Privacy', icon: 'lock', href: 'privacy.html', text: 'Watch history, playlists and who sees your subscriptions.' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', href: 'notifications.html', text: 'Uploads, replies and mentions, and finished processing.' },
    { id: 'language', label: 'Language', icon: 'globe', href: 'language.html', text: 'Language, region and time zone.' },
  ];

  // ---- Device-only state (everything that is not an appearance override) ----
  const STORE_KEY = 'taitube-settings-device';
  const DEFAULTS = { modeChoice: null, contrast: 'standard', accent: null, captions: true, captionLang: 'en', quality: 'auto', speed: '1', autoplayNext: true, hoverPreview: true, ambientPlayer: true, stats: false };
  const loadDevice = () => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') };
    } catch {
      return { ...DEFAULTS };
    }
  };
  const device = loadDevice();
  const saveDevice = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(device));
    } catch {
      // Storage is optional: a blocked window keeps the choice for this page only.
    }
  };

  // ---- Shell ----
  const buildShell = () => {
    const main = $('main');
    const nav = SECTIONS.map(
      (s) => `<a href="${s.href}"${s.id === document.body.dataset.section ? ' aria-current="page"' : ''}>${icon(s.icon)}<span>${s.label}</span></a>`,
    ).join('');
    const shell = document.createElement('div');
    shell.className = 'tt-shell';
    shell.innerHTML = html`
      <a class="tt-sr-only" href="#main">Skip to content</a>
      <header class="tt-header">
        <a class="tt-brand" href="../home.html">${icon('mark', 'tt-icon s-mark')}<b>taitube</b></a>
        <a class="tt-search s-hide-compact" href="index.html#search" aria-label="Search settings">${icon('search')}<span class="s-ellipsis tt-muted">Search settings</span></a>
        <span class="tt-spacer s-compact-only"></span>
        <a class="tt-iconbtn s-compact-only" href="index.html#search" aria-label="Search settings">${icon('search')}</a>
        <a class="tt-btn tt-btn--secondary s-hide-compact" href="http://localhost:5174/upload">${icon('plus')}Create</a>
        <a class="tt-iconbtn s-bell" href="../notifications.html" aria-label="Notifications, 3 new">${icon('bell')}<span class="s-bell-dot" aria-hidden="true"></span></a>
        <a class="s-account" href="../you.html" aria-label="Your account"><span class="tt-avatar" data-avatar="#facc15 #be123c" aria-hidden="true">J</span></a>
      </header>
      <div class="s-body">
        <nav class="s-nav" aria-label="Settings sections"><h2 class="tt-overline">Settings</h2>${nav}</nav>
        <div class="s-pane"></div>
      </div>
      <nav class="tt-tabbar" aria-label="Main">
        <a href="../home.html">${icon('home', 'tt-icon tt-icon--24')}<span>Home</span></a>
        <a href="../shorts.html">${icon('shorts', 'tt-icon tt-icon--24')}<span>Shorts</span></a>
        <a href="../home.html#subscriptions">${icon('following', 'tt-icon tt-icon--24')}<span>Subscriptions</span></a>
        <a href="../you.html" aria-current="page">${icon('you', 'tt-icon tt-icon--24')}<span>You</span></a>
      </nav>
      <div class="s-toasts" aria-live="polite"></div>`;
    document.body.prepend(shell);
    $('.s-pane', shell).append(main);
    main.id = 'main';
    main.tabIndex = -1;
    main.classList.add('s-main');

    const { backHref, backLabel, backAlways } = document.body.dataset;
    if (backHref) {
      const back = document.createElement('a');
      back.className = `s-back${backAlways ? ' s-back--always' : ''}`;
      back.href = backHref;
      back.innerHTML = `${icon('chevron-left')}${escape(backLabel ?? 'Settings')}`;
      main.prepend(back);
    }
  };

  const paint = (root = document) => {
    for (const el of $$('[data-thumb]', root)) el.style.background = TT.thumb(el.dataset.thumb.split(' '));
    for (const el of $$('[data-avatar]', root)) el.style.background = TT.avatar(el.dataset.avatar.split(' '));
  };

  const toast = (text, action) => {
    const node = document.createElement('div');
    node.className = 'tt-toast';
    node.append(Object.assign(document.createElement('span'), { textContent: text }));
    if (action) {
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'tt-btn tt-btn--ghost tt-btn--sm', textContent: action.label });
      button.addEventListener('click', () => {
        node.remove();
        action.run();
      });
      node.append(button);
    }
    $('.s-toasts').append(node);
    setTimeout(() => node.remove(), action ? 6000 : 2600);
  };

  buildShell();
  paint();

  let tokens;
  let state;
  let update;
  let resolve;
  try {
    ({ tokens, state, update, resolve } = await TT.ready);
  } catch {
    return;
  }

  // ---- Saved line: every change applies at once and stays on this device ----
  let savedTimer;
  const saved = (text = 'Saved on this device') => {
    const line = $('[data-saved]');
    if (!line) return;
    line.dataset.flash = 'true';
    line.innerHTML = `${icon('check', 'tt-icon tt-icon--16')}${escape(text)}`;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      line.dataset.flash = 'false';
      line.textContent = 'Changes apply at once and stay on this device.';
    }, 2200);
  };

  // ---- Colour helpers for the accent roles ----
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const toHex = (channels) => `#${channels.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
  const luminance = (hex) => {
    const [r, g, b] = rgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (a, b, t) => toHex(rgb(a).map((c, i) => c + (rgb(b)[i] - c) * t));
  const ensure = (hex, against, target, toward) => {
    let out = hex;
    for (let i = 0; i < 24 && ratio(out, against) < target; i++) out = mix(out, toward, 0.08);
    return out;
  };

  const roles = (theme, mode) => {
    const source = tokens.theme[theme];
    const merged = { ...source.dark, ...(mode === 'light' ? source.light : {}), ...(mode === 'oled' ? source.oled : {}) };
    return Object.fromEntries(entries(merged).map(([role, token]) => [role, resolve(token.$value)]));
  };
  const currentRoles = () => roles(state.theme, state.mode);

  const deriveAccent = (picked, r) => {
    const accent = ensure(picked, r.bg, 3, r.fg);
    const ink = ensure(accent, r.bg, 4.5, r.fg);
    const onAccent = ratio('#ffffff', accent) >= ratio('#0c0b09', accent) ? '#ffffff' : '#0c0b09';
    return {
      picked,
      accent,
      ink,
      onAccent,
      hover: mix(accent, r.fg, 0.15),
      soft: `${accent}29`,
      accentRatio: ratio(accent, r.bg),
      inkRatio: ratio(ink, r.bg),
      onRatio: ratio(onAccent, accent),
      adjusted: accent.toLowerCase() !== picked.toLowerCase(),
    };
  };
  const accentVars = (d) => ({ '--accent': d.accent, '--accent-hover': d.hover, '--on-accent': d.onAccent, '--accent-ink': d.ink, '--accent-soft': d.soft, '--focus-ring': d.ink });

  // Contrast and the accent override are layered over what design.js writes, after every appearance change.
  const applyExtras = () => {
    const root = document.documentElement;
    const r = currentRoles();
    root.dataset.contrast = device.contrast;
    if (device.contrast === 'more') {
      root.style.setProperty('--fg-muted', r.fg);
      root.style.setProperty('--fg-subtle', r['fg-muted']);
      root.style.setProperty('--border', r['border-strong']);
      root.style.setProperty('--border-strong', r.fg);
    }
    if (device.accent) for (const [name, value] of Object.entries(accentVars(deriveAccent(device.accent, r)))) root.style.setProperty(name, value);
  };

  // ---- Token sets: one varsFor per group, mirroring the writers in design.js, for previews of a set not in use ----
  const stack = (families) => families.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
  const shadowCss = (layers) => layers.map((s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`).join(', ');
  const varsFor = (group, id) => {
    const set = tokens.set[group][id];
    const family = state.mode === 'light' ? 'light' : 'dark';
    const out = {};
    switch (group) {
      case 'typography':
        for (const [role, t] of entries(set.font)) out[`--font-${role}`] = stack(t.$value);
        for (const [style, t] of entries(set.weight)) out[`--type-${style}-weight`] = String(t.$value);
        for (const [style, t] of entries(set.tracking)) out[`--type-${style}-tracking`] = t.$value;
        break;
      case 'fontSize':
        for (const [style, t] of entries(set)) {
          out[`--type-${style}-size`] = t.$value.size;
          out[`--type-${style}-line`] = String(t.$value.lineHeight);
        }
        break;
      case 'spacing':
        for (const [role, t] of entries(set)) out[`--${role}`] = t.$value;
        break;
      case 'sizing':
        for (const kind of ['control', 'icon', 'avatar']) for (const [size, t] of entries(set[kind])) out[`--size-${kind}-${size}`] = t.$value;
        for (const [name, t] of entries(set.layout)) out[`--layout-${name}`] = t.$value;
        break;
      case 'radius':
        for (const [role, t] of entries(set)) out[`--r-${role}`] = t.$value;
        break;
      case 'border':
        for (const [role, t] of entries(set)) out[`--border-${role}`] = t.$value;
        break;
      case 'shadow':
        for (const step of [1, 2, 3]) out[`--shadow-${step}`] = shadowCss(set[`${family}-${step}`].$value);
        break;
      case 'ambient':
        out['--ambient'] = String(set[`opacity-${family}`].$value);
        out['--ambient-blur'] = set.blur.$value;
        break;
      case 'motion':
        for (const [name, t] of entries(set.duration)) out[`--duration-${name}`] = t.$value;
        for (const [name, t] of entries(set.easing)) out[`--ease-${name}`] = `cubic-bezier(${t.$value.join(', ')})`;
        break;
    }
    return out;
  };

  // One entry per token group: label, description, search keywords, preview markup, one-line summary of a set.
  const GROUPS = {
    typography: {
      label: 'Typeface', text: 'The font family used for titles, text and numbers.', keywords: 'font family face type text serif',
      summary: (v) => (v['--font-sans'] ?? '').split(',')[0].replace(/"| Variable/g, ''),
      preview: () => '<p class="tt-title">Night trams of Lisbon</p><p class="tt-body-sm tt-muted">Marta Reis Films · 12 min</p><p class="tt-editorial">One take, one camcorder.</p>',
    },
    fontSize: {
      label: 'Text size', text: 'How large text is, from card titles to captions.', keywords: 'font size bigger larger smaller zoom reading text',
      summary: (v) => `Body ${v['--type-body-size']}`,
      preview: () => '<p class="tt-title-lg">Tonight on your shelf</p><p class="tt-body">Descriptions and comments read at this size.</p>',
    },
    spacing: {
      label: 'Spacing', text: 'The room inside cards and controls and between shelves.', keywords: 'padding gaps density airy compact whitespace room',
      summary: (v) => `Cards inset ${v['--inset-card']}, sections ${v['--section']}`,
      preview: () => '<div class="s-pv-form"><span class="tt-label">Playlist name</span><span class="tt-input s-fake">Late trains</span><span class="tt-btn tt-btn--primary">Create</span></div>',
    },
    sizing: {
      label: 'Control size', text: 'How big buttons, icons, avatars and the header are.', keywords: 'buttons icons avatars touch targets bigger smaller header',
      summary: (v) => `Controls ${v['--size-control-md']}, touch target ${v['--layout-touch-target']}`,
      preview: () => `<div class="s-pv-row"><span class="tt-btn tt-btn--secondary">Subscribe</span><span class="tt-avatar" data-avatar="#f59e0b #7c2d12"></span>${icon('bell')}${icon('share')}</div>`,
    },
    radius: {
      label: 'Corners', text: 'How round buttons, cards and thumbnails are.', keywords: 'corners rounded radius sharp round shape edges',
      summary: (v) => `Cards ${v['--r-card']}, controls ${v['--r-control']}`,
      preview: () => '<div class="s-pv-row"><span class="tt-btn tt-btn--primary">Watch</span></div><div class="tt-card"><span class="tt-label">Marta Reis Films</span><div class="tt-thumb" data-thumb="#f97316 #9d174d #14102e"></div></div>',
    },
    border: {
      label: 'Borders', text: 'The weight of outlines, dividers and the focus ring.', keywords: 'outline lines hairline bold stroke focus ring thick',
      summary: (v) => `Controls ${v['--border-control']}, focus ${v['--border-focus']}`,
      preview: () => '<span class="tt-input s-fake">Search videos</span><span class="tt-btn tt-btn--outline">Filters</span><hr class="tt-separator">',
    },
    shadow: {
      label: 'Shadows', text: 'How far cards and menus lift off the page.', keywords: 'elevation depth flat lift drop',
      summary: (v) => (v['--shadow-2'].startsWith('0px 0px 0px 0px') ? 'No shadow' : `Raised: ${v['--shadow-2'].split(', ').length} layers`),
      preview: () => '<div class="s-pv-elev tt-caption">Card</div><div class="s-pv-elev tt-caption">Menu</div><div class="s-pv-elev tt-caption">Dialog</div>',
    },
    ambient: {
      label: 'Ambient glow', text: 'The soft light cast behind the video you are watching.', keywords: 'glow cinematic light backlight behind video bloom',
      summary: (v) => (Number(v['--ambient']) === 0 ? 'No glow' : `Glow ${Math.round(Number(v['--ambient']) * 100)}%, blur ${v['--ambient-blur']}`),
      preview: () => '<div class="s-glow" data-thumb="#f97316 #9d174d #14102e"></div><div class="tt-thumb" data-thumb="#38bdf8 #1e3a8a #0b1020"></div>',
    },
    motion: {
      label: 'Motion', text: 'How quickly things move when you open, hover and switch.', keywords: 'animation transitions reduce calm speed slow fast',
      summary: (v) => `Base ${v['--duration-base']}, slow ${v['--duration-slow']}`,
      preview: () => '<div class="s-track"><span class="tt-chip">Moving</span></div>',
    },
  };
  const groupMeta = (group) => GROUPS[group] ?? { label: label(group), text: '', keywords: group, summary: () => '', preview: () => '' };
  const groupIds = () => entries(tokens.set).map(([group]) => group);
  const setIds = (group) => entries(tokens.set[group]).map(([id]) => id);
  const defaultOf = (group) => tokens.theme[state.theme].defaults[group].$value;
  const currentOf = (group) => state.overrides[group] || defaultOf(group);
  const isChanged = (group) => Boolean(state.overrides[group]) && state.overrides[group] !== defaultOf(group);
  const setOverride = (group, id) => {
    const next = { ...state.overrides };
    if (!id || id === defaultOf(group)) delete next[group];
    else next[group] = id;
    update({ overrides: next });
    saved();
  };
  const SET_LABELS = { fontSize: { small: 'Small', default: 'Default', large: 'Large', xlarge: 'Extra large' }, ambient: { off: 'Off', subtle: 'Subtle', cinematic: 'Cinematic' } };
  const setLabel = (group, id) => SET_LABELS[group]?.[id] ?? label(id);

  // ---- Controls ----
  const radioSeg = (name, legend, options, onPick) => {
    const group = document.createElement('fieldset');
    group.className = 's-seg';
    group.innerHTML = `<legend class="tt-sr-only">${escape(legend)}</legend>${options
      .map((o) => `<label><input class="tt-sr-only" type="radio" name="${name}" value="${escape(o.value)}"><span>${escape(o.label)}</span></label>`)
      .join('')}`;
    group.addEventListener('change', (event) => onPick(event.target.value));
    return group;
  };

  const systemMode = () => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const modeChoice = () => (device.modeChoice === 'system' && state.mode === systemMode() ? 'system' : state.mode);
  const setMode = (value) => {
    device.modeChoice = value;
    saveDevice();
    update({ mode: value === 'system' ? systemMode() : value });
    saved();
  };
  const densityChoice = () => {
    const [spacing, sizing] = [state.overrides.spacing, state.overrides.sizing];
    if (!spacing && !sizing) return 'comfortable';
    return spacing === 'compact' && sizing === 'small' ? 'compact' : null;
  };
  const setDensity = (value) => {
    const next = { ...state.overrides };
    if (value === 'compact') Object.assign(next, { spacing: 'compact', sizing: 'small' });
    else {
      delete next.spacing;
      delete next.sizing;
    }
    update({ overrides: next });
    saved();
  };
  const setDevice = (key, value) => {
    device[key] = value;
    saveDevice();
    if (key === 'contrast') update({});
    syncAll();
    saved();
  };

  const parseOptions = (text) => text.split('|').map((pair) => ({ value: pair.slice(0, pair.indexOf(':')), label: pair.slice(pair.indexOf(':') + 1) }));
  const BINDINGS = {
    'fn:mode': { options: () => [{ value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'oled', label: 'OLED' }], get: modeChoice, set: setMode },
    'fn:density': { options: () => [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }], get: densityChoice, set: setDensity },
  };
  const binding = (host) => {
    const key = host.dataset.bind;
    if (BINDINGS[key]) return BINDINGS[key];
    const [kind, name] = key.split(':');
    if (kind === 'ov') return { options: () => setIds(name).map((id) => ({ value: id, label: setLabel(name, id) })), get: () => currentOf(name), set: (v) => setOverride(name, v) };
    return { options: () => parseOptions(host.dataset.options ?? ''), get: () => String(device[name]), set: (v) => setDevice(name, typeof DEFAULTS[name] === 'boolean' ? v === 'true' : v) };
  };

  const syncers = [];
  const syncAll = () => syncers.forEach((fn) => fn());

  const hydrate = () => {
    for (const host of $$('[data-ctl]')) {
      const b = binding(host);
      const legend = host.dataset.legend ?? '';
      if (host.dataset.ctl === 'seg') {
        const group = radioSeg(`seg-${++uid}`, legend, b.options(), (v) => b.set(v));
        host.append(group);
        syncers.push(() => $$('input', group).forEach((input) => (input.checked = input.value === b.get())));
      } else if (host.dataset.ctl === 'switch') {
        const name = host.dataset.bind.split(':')[1];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tt-switch';
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-labelledby', host.dataset.labelledby);
        button.addEventListener('click', () => setDevice(name, !device[name]));
        host.append(button);
        syncers.push(() => button.setAttribute('aria-checked', String(Boolean(device[name]))));
      } else if (host.dataset.ctl === 'select') {
        const select = document.createElement('select');
        select.className = 'tt-input';
        select.setAttribute('aria-labelledby', host.dataset.labelledby);
        select.innerHTML = b.options().map((o) => `<option value="${escape(o.value)}">${escape(o.label)}</option>`).join('');
        select.addEventListener('change', () => b.set(select.value));
        host.append(select);
        syncers.push(() => (select.value = b.get()));
      }
    }
    syncAll();
  };

  const highlight = () => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target || target.id === 'search') return;
    target.classList.remove('is-highlighted');
    void target.offsetWidth;
    target.classList.add('is-highlighted');
    target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  window.addEventListener('hashchange', highlight);

  // ---- Settings index: every row registers an id, label, keywords and section ----
  const buildIndex = () => {
    const rows = [
      { id: 'theme', label: 'Theme', keywords: 'sand nocturne colours look palette', section: 'appearance', page: 'appearance.html', text: 'Pick the look of the whole app.' },
      { id: 'mode', label: 'Mode', keywords: 'dark light oled night system automatic black', section: 'appearance', page: 'appearance.html', text: 'Follow your device, or choose dark, light or OLED.' },
      { id: 'accent', label: 'Accent colour', keywords: 'accent colour color highlight brand buttons', section: 'appearance', page: 'appearance.html', text: 'The colour of buttons, progress and selection.' },
      { id: 'density', label: 'Density', keywords: 'compact comfortable tight roomy spacing size', section: 'appearance', page: 'appearance.html', text: 'Comfortable or compact.' },
      { id: 'fine-tune', label: 'Fine-tune the look', keywords: 'advanced token sets customise customize every', section: 'appearance', page: 'appearance.html', text: 'Every part of the look, one control each.' },
      ...groupIds().map((group) => ({ id: group, label: groupMeta(group).label, keywords: groupMeta(group).keywords, section: 'appearance', crumb: 'Fine-tune the look', page: 'advanced.html', text: groupMeta(group).text })),
      { id: 'font-size', label: 'Text size', keywords: 'font bigger larger reading zoom', section: 'accessibility', page: 'accessibility.html', text: 'Make text larger or smaller everywhere.' },
      { id: 'contrast', label: 'Contrast', keywords: 'more contrast readable low vision stronger', section: 'accessibility', page: 'accessibility.html', text: 'Stronger text and outlines.' },
      { id: 'motion', label: 'Motion', keywords: 'reduce motion animation calm vestibular', section: 'accessibility', page: 'accessibility.html', text: 'Standard, calm or reduced.' },
      { id: 'borders', label: 'Borders', keywords: 'outline lines bold focus ring', section: 'accessibility', page: 'accessibility.html', text: 'Thicker outlines and focus ring.' },
      { id: 'captions', label: 'Captions', keywords: 'subtitles cc language default on', section: 'accessibility', page: 'accessibility.html', text: 'Turn captions on by default and choose their language.' },
      { id: 'quality', label: 'Default quality', keywords: 'resolution 1080p 720p auto data saver bandwidth', section: 'playback', page: 'playback.html', text: 'The quality a video starts at.' },
      { id: 'speed', label: 'Default speed', keywords: 'playback rate faster slower', section: 'playback', page: 'playback.html', text: 'How fast videos play.' },
      { id: 'autoplay-next', label: 'Autoplay next', keywords: 'queue continue up next', section: 'playback', page: 'playback.html', text: 'Keep going when a video ends.' },
      { id: 'hover-preview', label: 'Hover preview', keywords: 'preview thumbnail video motion cards', section: 'playback', page: 'playback.html', text: 'Play a short preview when you hover a card.' },
      { id: 'ambient-player', label: 'Ambient mode in the player', keywords: 'glow cinematic light behind video', section: 'playback', page: 'playback.html', text: 'A soft glow behind the player.' },
      { id: 'stats-overlay', label: 'Stats overlay', keywords: 'stats nerds debug bitrate dropped frames', section: 'playback', page: 'playback.html', text: 'Show technical details over the video.' },
      { id: 'pause-history', label: 'Pause watch history', keywords: 'history stop recording incognito', section: 'privacy', page: 'privacy.html', text: 'Stop adding videos to your history.' },
      { id: 'clear-history', label: 'Clear watch history', keywords: 'history delete remove', section: 'privacy', page: 'privacy.html', text: 'Remove everything you have watched.' },
      { id: 'playlist-visibility', label: 'Default playlist visibility', keywords: 'playlists private public unlisted who can see', section: 'privacy', page: 'privacy.html', text: 'Who can see a new playlist.' },
      { id: 'subscriptions-visibility', label: 'Subscriptions visibility', keywords: 'subscriptions private public channels following', section: 'privacy', page: 'privacy.html', text: 'Who can see the channels you subscribe to.' },
      { id: 'notify-uploads', label: 'Uploads from subscriptions', keywords: 'new videos subscriptions alerts bell', section: 'notifications', page: 'notifications.html', text: 'Tell me when a channel I follow uploads.' },
      { id: 'notify-replies', label: 'Replies and mentions', keywords: 'comments reply mention alerts', section: 'notifications', page: 'notifications.html', text: 'Tell me when someone replies or mentions me.' },
      { id: 'notify-processing', label: 'Processing finished', keywords: 'upload transcoding ready published creator', section: 'notifications', page: 'notifications.html', text: 'Tell me when my upload is ready.' },
      { id: 'channel-overrides', label: 'Per-channel notifications', keywords: 'channels all highlights none override', section: 'notifications', page: 'notifications.html', text: 'Choose how much each channel can notify you.' },
      { id: 'interface-language', label: 'Interface language', keywords: 'language locale translation english', section: 'language', page: 'language.html', text: 'The language of menus and buttons.' },
      { id: 'time-zone', label: 'Time zone', keywords: 'timezone clock dates times region', section: 'language', page: 'language.html', text: 'Used for premieres, schedules and dates.' },
      { id: 'formats', label: 'Date and number format', keywords: 'format dates numbers region locale', section: 'language', page: 'language.html', text: 'How dates and numbers are written.' },
    ];
    return rows.map((row) => ({ ...row, sectionLabel: SECTIONS.find((s) => s.id === row.section).label, href: `${row.page}#${row.id}` }));
  };

  // ---- Pages ----
  const pages = {};

  pages.index = () => {
    const index = buildIndex();
    const input = $('#settings-search');
    const results = $('#results');
    const cards = $('#section-cards');
    const status = $('#results-status');
    cards.innerHTML = SECTIONS.map(
      (s) => html`<article class="tt-card s-card-link"><span class="s-tile">${icon(s.icon, 'tt-icon tt-icon--24')}</span>
        <div><h3 class="tt-title"><a href="${s.href}">${s.label}</a></h3><p class="tt-body-sm tt-muted">${s.text}</p></div></article>`,
    ).join('');
    const mark = (text, terms) => terms.reduce((out, term) => out.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'), escape(text));
    const run = () => {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      $('#cards-wrap').hidden = Boolean(terms.length);
      $('#results-wrap').hidden = !terms.length;
      if (!terms.length) {
        status.textContent = '';
        return;
      }
      const found = index.filter((row) => terms.every((t) => `${row.label} ${row.keywords} ${row.sectionLabel} ${row.text}`.toLowerCase().includes(t)));
      results.innerHTML = found
        .map((row) => html`<li><a href="${row.href}"><span class="tt-title">${mark(row.label, terms)}</span>
          <span class="tt-body-sm tt-muted">${row.sectionLabel}${row.crumb ? ` › ${row.crumb}` : ''} · ${escape(row.text)}</span></a></li>`)
        .join('');
      $('#no-results').hidden = found.length > 0;
      $('#no-results-term').textContent = input.value.trim();
      status.textContent = found.length ? `${found.length} ${found.length === 1 ? 'setting' : 'settings'} found` : 'No settings found';
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        input.value = '';
        run();
      }
      if (event.key === 'Enter') $('a', results)?.click();
    });
    const query = new URLSearchParams(location.search).get('q');
    if (query) input.value = query;
    run();
    if (location.hash === '#search' || query) input.focus();
    window.addEventListener('hashchange', () => location.hash === '#search' && input.focus());
  };

  const previewShell = (group, id, summaryTarget) => {
    const el = document.createElement('div');
    el.className = `s-pv${group === 'ambient' ? ' s-pv--ambient' : ''}`;
    el.setAttribute('aria-hidden', 'true');
    el.dataset.ambient = id;
    el.innerHTML = groupMeta(group).preview();
    const apply = () => {
      const vars = varsFor(group, id);
      for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
      el.dataset.ambient = id;
      if (summaryTarget) summaryTarget.textContent = groupMeta(group).summary(vars);
    };
    apply();
    paint(el);
    return { el, apply };
  };

  pages.appearance = () => {
    // Themes
    const themes = $('#theme-options');
    const cards = entries(tokens.theme).map(([id, theme]) => {
      const wrap = document.createElement('label');
      wrap.className = 's-choice';
      wrap.innerHTML = html`<input class="tt-sr-only" type="radio" name="theme" value="${id}">
        <div class="s-pv s-pv--theme" aria-hidden="true"><div class="s-bar"><span class="tt-avatar tt-avatar--xs" data-avatar="#facc15 #be123c"></span><i></i></div>
          <div class="tt-thumb" data-thumb="#f97316 #9d174d #14102e"></div>
          <div class="s-pv-row"><span class="tt-btn tt-btn--primary tt-btn--sm">Subscribe</span><span class="tt-caption tt-muted">Marta Reis Films</span></div></div>
        <div class="s-choice-text"><span class="s-choice-title tt-title">${icon('check')}${label(id)}</span><span class="s-swatches" aria-hidden="true"></span>
          <span class="tt-body-sm tt-muted">${escape((theme.$description ?? '').split('.').slice(0, 2).join('.').trim())}.</span></div>`;
      wrap.querySelector('input').addEventListener('change', () => {
        update({ theme: id });
        saved();
      });
      themes.append(wrap);
      return { id, wrap };
    });
    const paintThemes = () => {
      for (const { id, wrap } of cards) {
        const r = roles(id, state.mode);
        const pv = $('.s-pv', wrap);
        for (const role of ['bg', 'surface', 'raised', 'border', 'fg', 'fg-muted', 'tint', 'tint-strong', 'accent', 'accent-hover', 'on-accent', 'accent-ink', 'accent-soft']) pv.style.setProperty(`--${role}`, r[role]);
        $('.s-swatches', wrap).innerHTML = ['bg', 'surface', 'accent', 'fg'].map((role) => `<i style="background:${r[role]}"></i>`).join('');
        $('input', wrap).checked = id === state.theme;
      }
      paint(themes);
    };

    // Accent: pick, preview the derived roles, then confirm
    const swatches = [
      ['Brass', '{ref.ochre.500}'], ['Marquee amber', '{ref.amber.500}'], ['Blue ink', '{ref.ink.500}'],
      ['Sky', '{ref.signal.blue-300}'], ['Moss', '{ref.signal.green-300}'], ['Coral', '{ref.signal.coral-300}'], ['Rose', '{ref.signal.red-300}'],
    ].map(([name, token]) => ({ name, hex: resolve(token).slice(0, 7) }));
    let pending = device.accent ?? 'theme';
    const dots = $('#accent-dots');
    const preview = $('#accent-derived');
    dots.innerHTML = [
      html`<label class="s-dot"><input class="tt-sr-only" type="radio" name="accent" value="theme"><span><i data-theme-accent></i>Theme accent</span></label>`,
      ...swatches.map((s) => html`<label class="s-dot"><input class="tt-sr-only" type="radio" name="accent" value="${s.hex}"><span><i style="background:${s.hex}"></i>${s.name}</span></label>`),
      html`<label class="s-dot"><input type="color" name="accent-custom" aria-label="Custom colour" value="${device.accent ?? swatches[0].hex}"><span><i data-custom-dot></i>Custom</span></label>`,
    ].join('');
    const customInput = $('input[type="color"]', dots);
    const renderAccent = () => {
      const r = currentRoles();
      const themeDot = $('[data-theme-accent]', dots);
      themeDot.style.background = r.accent;
      $('[data-custom-dot]', dots).style.background = customInput.value;
      for (const input of $$('input[type="radio"]', dots)) input.checked = input.value.toLowerCase() === String(pending).toLowerCase();
      const isTheme = pending === 'theme';
      customInput.parentElement.classList.toggle('is-on', !isTheme && !swatches.some((sw) => sw.hex.toLowerCase() === String(pending).toLowerCase()));
      const d = deriveAccent(isTheme ? r.accent : pending, r);
      const vars = Object.entries(accentVars(isTheme ? { ...d, accent: r.accent, ink: r['accent-ink'], onAccent: r['on-accent'], hover: r['accent-hover'], soft: r['accent-soft'] } : d)).map(([k, v]) => `${k}:${v}`).join(';');
      const ok = (value, min) => `<span class="${value >= min ? 's-ok' : 's-warn'}">${value.toFixed(1)}:1 ${value >= min ? 'passes' : 'low'}</span>`;
      const applied = (device.accent ?? 'theme').toLowerCase() === String(pending).toLowerCase();
      preview.innerHTML = html`<div class="s-accent" style="${vars}">
        <div class="s-pv-row"><span class="tt-btn tt-btn--primary">Subscribe</span><a class="tt-accent-ink tt-label" href="#accent" tabindex="-1">Open playlist</a><span class="tt-badge tt-badge--soft">Selected</span></div>
        <ul aria-label="Derived colours">
          <li><i style="background:${isTheme ? r.accent : d.accent}"></i><span><span class="tt-label">Accent</span><span class="tt-caption">${ok(d.accentRatio, 3)} on the page</span></li>
          <li><i style="background:${isTheme ? r['accent-ink'] : d.ink}"></i><span><span class="tt-label">Accent as text</span><span class="tt-caption">${ok(d.inkRatio, 4.5)}</span></span></li>
          <li><i style="background:${isTheme ? r['on-accent'] : d.onAccent}"></i><span><span class="tt-label">Text on accent</span><span class="tt-caption">${ok(d.onRatio, 4.5)}</span></span></li>
        </ul>
        ${!isTheme && d.adjusted ? `<p class="tt-body-sm s-warn">${icon('alert', 'tt-icon tt-icon--16')} ${escape(d.picked)} is too faint on this ${state.mode} page. Taitube will use ${escape(d.accent)} instead, so buttons and focus stay visible.</p>` : ''}
        <div class="s-pv-row"><button type="button" class="tt-btn tt-btn--primary" data-accent-apply ${applied ? 'disabled' : ''}>Apply accent</button><button type="button" class="tt-btn tt-btn--ghost" data-accent-cancel ${applied ? 'disabled' : ''}>Cancel</button>
          <span class="tt-caption tt-muted">${applied ? 'This is your current accent.' : 'Not applied yet.'}</span></div></div>`;
    };
    dots.addEventListener('change', (event) => {
      pending = event.target.value;
      renderAccent();
    });
    customInput.addEventListener('input', () => {
      pending = customInput.value;
      renderAccent();
    });
    preview.addEventListener('click', (event) => {
      if (event.target.closest('[data-accent-apply]')) {
        device.accent = pending === 'theme' ? null : pending;
        saveDevice();
        update({});
        saved();
        toast(device.accent ? 'Accent applied' : 'Back to the theme accent');
      } else if (event.target.closest('[data-accent-cancel]')) {
        pending = device.accent ?? 'theme';
        renderAccent();
      }
    });

    const refresh = () => {
      paintThemes();
      renderAccent();
    };
    document.addEventListener('tt:appearance', refresh);
    refresh();
  };

  pages.advanced = () => {
    const groups = $('#groups');
    const live = [];
    const rows = groupIds().map((group) => {
      const meta = groupMeta(group);
      const section = document.createElement('section');
      section.className = 's-group';
      section.id = group;
      section.setAttribute('aria-labelledby', `h-${group}`);
      section.innerHTML = html`<div class="s-group-head"><div><h2 class="tt-title-lg" id="h-${group}">${meta.label}</h2><p class="tt-body-sm tt-muted">${meta.text}</p></div>
        <span class="tt-badge tt-badge--soft" data-changed hidden>Changed</span>
        <button type="button" class="tt-btn tt-btn--ghost tt-btn--sm" data-reset hidden aria-label="Reset ${escape(meta.label.toLowerCase())} to the theme default">Reset</button></div>
        <fieldset class="s-options"><legend class="tt-sr-only">${meta.label}</legend></fieldset>`;
      const options = $('.s-options', section);
      const choices = [{ value: '', default: true }, ...setIds(group).map((id) => ({ value: id }))].map((choice) => {
        const wrap = document.createElement('label');
        wrap.className = 's-choice';
        wrap.innerHTML = html`<input class="tt-sr-only" type="radio" name="set-${group}" value="${choice.value}">
          <div data-preview></div>
          <div class="s-choice-text"><span class="s-choice-title tt-label">${icon('check')}<span data-title></span></span><span class="tt-caption tt-muted" data-summary></span></div>`;
        const pv = previewShell(group, choice.default ? defaultOf(group) : choice.value, $('[data-summary]', wrap));
        $('[data-preview]', wrap).replaceWith(pv.el);
        live.push(() => {
          const id = choice.default ? defaultOf(group) : choice.value;
          pv.el.style.cssText = '';
          for (const [name, value] of Object.entries(varsFor(group, id))) pv.el.style.setProperty(name, value);
          pv.el.dataset.ambient = id;
          $('[data-summary]', wrap).textContent = meta.summary(varsFor(group, id));
          $('[data-title]', wrap).textContent = choice.default ? `Theme default (${setLabel(group, defaultOf(group))})` : setLabel(group, choice.value);
          $('input', wrap).checked = choice.default ? !state.overrides[group] : state.overrides[group] === choice.value;
        });
        wrap.querySelector('input').addEventListener('change', () => setOverride(group, choice.value));
        options.append(wrap);
        return wrap;
      });
      $('[data-reset]', section).addEventListener('click', () => {
        setOverride(group, '');
        $('input:checked', section)?.focus();
      });
      groups.append(section);
      return { group, section };
    });

    const resetAll = $('#reset-all');
    const changedCount = $('#changed-count');
    const sync = () => {
      for (const fn of live) fn();
      let count = 0;
      for (const { group, section } of rows) {
        const changed = isChanged(group);
        count += changed ? 1 : 0;
        $('[data-changed]', section).hidden = !changed;
        $('[data-reset]', section).hidden = !changed;
      }
      resetAll.disabled = count === 0;
      changedCount.textContent = count === 0 ? 'Everything is on the theme defaults.' : `${count} ${count === 1 ? 'setting differs' : 'settings differ'} from the theme defaults.`;
      paint(groups);
    };
    resetAll.addEventListener('click', () => {
      update({ overrides: {} });
      saved('Back to the theme defaults');
    });
    document.addEventListener('tt:appearance', sync);
    sync();
  };

  pages.accessibility = () => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const line = $('#system-motion');
    const show = () => {
      line.innerHTML = reduced.matches
        ? `${icon('info', 'tt-icon tt-icon--16')}<span><b>Your system is set to reduce motion right now.</b> Motion stays reduced whatever you choose here.</span>`
        : `${icon('info', 'tt-icon tt-icon--16')}<span>Your system is not asking for reduced motion. If you turn it on in your system settings, it always wins over this choice.</span>`;
    };
    reduced.addEventListener('change', show);
    show();
  };

  pages.playback = () => {
    const sync = () => {
      const quality = device.quality === 'auto' ? 'Auto' : `${device.quality}p`;
      $('#pv-meta').textContent = `${quality} · ${device.speed}×`;
      $('#pv-stats').hidden = !device.stats;
      $('#pv-glow').hidden = !device.ambientPlayer;
      $('#pv-hover').hidden = !device.hoverPreview;
      $('#pv-next').hidden = !device.autoplayNext;
      $('#pv-captions').hidden = !device.captions;
      $('#pv-stats').textContent = `Resolution  ${device.quality === 'auto' ? '1920 x 1080' : `${Math.round((device.quality * 16) / 9)} x ${device.quality}`}\nSpeed       ${device.speed}x\nBuffer      12.4 s\nDropped     0 frames`;
    };
    syncers.push(sync);
    sync();
  };

  const accountPage = () => {
    const out = $('#signed-out');
    const inn = $('#signed-in');
    const params = new URLSearchParams(location.search);
    let signedIn = params.get('state') === 'signed-in';
    let failing = false;
    const demo = $('#demo-view');
    const view = radioSeg('view', 'Preview the page as', [{ value: 'out', label: 'Signed out' }, { value: 'in', label: 'Signed in' }], (v) => {
      signedIn = v === 'in';
      render();
    });
    demo.append(view);
    const fail = Object.assign(document.createElement('button'), { type: 'button', className: 'tt-switch' });
    fail.setAttribute('role', 'switch');
    fail.setAttribute('aria-labelledby', 'fail-label');
    fail.addEventListener('click', () => {
      failing = !failing;
      fail.setAttribute('aria-checked', String(failing));
    });
    fail.setAttribute('aria-checked', 'false');
    $('#demo-fail').append(fail);
    const render = () => {
      out.hidden = signedIn;
      inn.hidden = !signedIn;
      $$('input', view).forEach((input) => (input.checked = (input.value === 'in') === signedIn));
    };
    render();

    // Account saves: debounced, optimistic, a failure keeps the change and offers Retry.
    const timers = new Map();
    const status = (row, kind, text, retry) => {
      const el = $('.s-row-status', row);
      el.dataset.state = kind;
      el.innerHTML = `${kind === 'saved' ? icon('check') : kind === 'failed' ? icon('alert') : ''}<span>${escape(text)}</span>`;
      if (retry) {
        const button = Object.assign(document.createElement('button'), { type: 'button', className: 'tt-btn tt-btn--ghost tt-btn--sm', textContent: 'Retry' });
        button.addEventListener('click', retry);
        el.append(button);
      }
    };
    const save = (row, name) => {
      status(row, 'saving', 'Saving to your account');
      clearTimeout(timers.get(row));
      timers.set(row, setTimeout(() => {
        if (failing) {
          const retry = () => save(row, name);
          status(row, 'failed', 'Not saved to your account. Your change is kept on this device.', retry);
          toast(`Could not save ${name}`, { label: 'Retry', run: retry });
        } else status(row, 'saved', 'Saved to your account');
      }, 700));
    };
    const rowOf = (id) => document.getElementById(id);

    return { save, rowOf };
  };

  pages.privacy = () => {
    const { save, rowOf } = accountPage();
    const pause = $('#pause-switch');
    pause.setAttribute('aria-checked', 'false');
    pause.addEventListener('click', () => {
      pause.setAttribute('aria-checked', String(pause.getAttribute('aria-checked') !== 'true'));
      save(rowOf('pause-history'), 'your history setting');
    });
    for (const [id, name] of [['playlist-visibility', 'playlist visibility'], ['subscriptions-visibility', 'subscriptions visibility']]) {
      const row = rowOf(id);
      $('fieldset', row).addEventListener('change', () => save(row, name));
    }
    const dialog = $('#clear-dialog');
    const clear = $('#clear-button');
    clear.addEventListener('click', () => dialog.showModal());
    dialog.addEventListener('click', (event) => event.target === dialog && dialog.close());
    $('[data-close]', dialog).addEventListener('click', () => dialog.close());
    $('[data-confirm]', dialog).addEventListener('click', () => {
      dialog.close();
      clear.disabled = true;
      clear.textContent = 'History is empty';
      $('#clear-meta').textContent = 'Nothing in your history. New videos will appear here again once you watch them.';
      save(rowOf('clear-history'), 'clearing your history');
      toast('Watch history cleared');
    });
  };

  pages.notifications = () => {
    const { save, rowOf } = accountPage();
    for (const [id, name] of [['notify-uploads', 'upload notifications'], ['notify-replies', 'reply notifications'], ['notify-processing', 'processing notifications']]) {
      const row = rowOf(id);
      const button = $('.tt-switch', row);
      button.setAttribute('aria-checked', 'true');
      button.addEventListener('click', () => {
        button.setAttribute('aria-checked', String(button.getAttribute('aria-checked') !== 'true'));
        save(row, name);
      });
    }
    for (const row of $$('[data-channel]')) $('fieldset', row).addEventListener('change', () => save(row, `${$('h3', row).textContent} notifications`));
    paint();
  };

  pages.language = () => {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const select = $('#zone-select');
    select.innerHTML = [`<option value="">Browser default (${escape(browser)})</option>`, ...zones.map((z) => `<option value="${escape(z)}">${escape(z.replace(/_/g, ' '))}</option>`)].join('');
    const preview = () => {
      const zone = select.value || browser;
      const now = new Date();
      const locale = $('#lang-select').value;
      $('#fmt-date').textContent = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short', timeZone: zone }).format(now);
      $('#fmt-relative').textContent = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-2, 'day');
      $('#fmt-number').textContent = new Intl.NumberFormat(locale).format(1284503.5);
      $('#fmt-compact').textContent = `${new Intl.NumberFormat(locale, { notation: 'compact' }).format(48200)} views`;
    };
    select.addEventListener('change', () => {
      preview();
      saved();
    });
    $('#lang-select').addEventListener('change', () => {
      preview();
      saved();
    });
    preview();
  };

  hydrate();
  applyExtras();
  document.addEventListener('tt:appearance', () => {
    applyExtras();
    syncAll();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => device.modeChoice === 'system' && update({ mode: systemMode() }));
  pages[page]?.();
  paint();
  syncAll();
  highlight();
})();
