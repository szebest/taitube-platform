// Applies docs/design/tokens.json to the page and mounts the appearance switcher.
// A page loads it with <script src="../lib/design.js" data-tokens="../tokens.json" defer></script>
// and waits on `TT.ready` before rendering anything that needs token values.
//
// It mirrors what @vp/ui's appearance engine does in the apps: a theme supplies the colour roles and a default
// implementation of every token set; the viewer may override any set; each set writes its own variables and a
// data-* attribute on <html>.
(() => {
  const script = document.currentScript;
  const tokensUrl = script?.dataset.tokens ?? 'tokens.json';
  const STORAGE_KEY = 'taitube-design-appearance';
  const MODES = ['dark', 'light', 'oled'];
  const DIRECTIONS = ['ltr', 'rtl'];

  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  };
  const write = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage is optional: a blocked or private window keeps the defaults.
    }
  };

  const keys = (group) => Object.keys(group ?? {}).filter((key) => !key.startsWith('$'));
  const entries = (group) => keys(group).map((key) => [key, group[key]]);
  const lookup = (tokens, path) => path.split('.').reduce((node, key) => node?.[key], tokens);
  const resolve = (tokens, value, depth = 0) => {
    if (typeof value !== 'string' || !value.startsWith('{') || depth > 16) return value;
    return resolve(tokens, lookup(tokens, value.slice(1, -1))?.$value, depth + 1);
  };
  const stack = (families) => families.map((family) => (family.includes(' ') ? `"${family}"` : family)).join(', ');
  const shadow = (layers) => layers.map((s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`).join(', ');
  const bezier = (points) => `cubic-bezier(${points.join(', ')})`;
  const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const label = (name) => kebab(name).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

  // One writer per token set group: each turns the chosen implementation into custom properties.
  const WRITERS = {
    typography(set, put) {
      for (const [role, token] of entries(set.font)) put(`--font-${role}`, stack(token.$value));
      for (const [style, token] of entries(set.weight)) put(`--type-${style}-weight`, String(token.$value));
      for (const [style, token] of entries(set.tracking)) put(`--type-${style}-tracking`, token.$value);
    },
    fontSize(set, put) {
      for (const [style, token] of entries(set)) {
        put(`--type-${style}-size`, token.$value.size);
        put(`--type-${style}-line`, String(token.$value.lineHeight));
      }
    },
    spacing(set, put) {
      for (const [role, token] of entries(set)) put(`--${role}`, token.$value);
    },
    sizing(set, put) {
      for (const family of ['control', 'icon', 'avatar']) for (const [size, token] of entries(set[family])) put(`--size-${family}-${size}`, token.$value);
      for (const [name, token] of entries(set.layout)) put(`--layout-${name}`, token.$value);
    },
    radius(set, put) {
      for (const [role, token] of entries(set)) put(`--r-${role}`, token.$value);
    },
    border(set, put) {
      for (const [role, token] of entries(set)) put(`--border-${role}`, token.$value);
    },
    shadow(set, put, mode) {
      const family = mode === 'light' ? 'light' : 'dark';
      for (const step of [1, 2, 3]) put(`--shadow-${step}`, shadow(set[`${family}-${step}`].$value));
    },
    ambient(set, put, mode) {
      put('--ambient', String(set[mode === 'light' ? 'opacity-light' : 'opacity-dark'].$value));
      put('--ambient-blur', set.blur.$value);
    },
    motion(set, put) {
      for (const [name, token] of entries(set.duration)) put(`--duration-${name}`, token.$value);
      for (const [name, token] of entries(set.easing)) put(`--ease-${name}`, bezier(token.$value));
    },
  };

  function rolesFor(tokens, themeName, mode) {
    const theme = tokens.theme[themeName];
    const merged = { ...theme.dark, ...(mode === 'light' ? theme.light : {}), ...(mode === 'oled' ? theme.oled : {}) };
    return Object.fromEntries(keys(merged).map((role) => [role, resolve(tokens, merged[role].$value)]));
  }

  function chosen(tokens, state) {
    const defaults = tokens.theme[state.theme].defaults;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return Object.fromEntries(
      Object.keys(WRITERS).map((group) => {
        const override = state.overrides[group];
        const pick = override && tokens.set[group][override] ? override : defaults[group].$value;
        return [group, group === 'motion' && reducedMotion ? 'reduced' : pick];
      }),
    );
  }

  function apply(tokens, state) {
    const root = document.documentElement;
    const put = (name, value) => root.style.setProperty(name, value);
    for (const [role, value] of Object.entries(rolesFor(tokens, state.theme, state.mode))) put(`--${role}`, value);
    const picks = chosen(tokens, state);
    for (const [group, impl] of Object.entries(picks)) {
      WRITERS[group](tokens.set[group][impl], put, state.mode);
      root.dataset[group] = impl;
    }
    for (const [name, token] of entries(tokens.scale.space)) put(`--space-${name}`, token.$value);
    for (const [name, token] of entries(tokens.scale.layout)) put(`--layout-${name}`, token.$value);
    root.dataset.theme = state.theme;
    root.dataset.mode = state.mode;
    root.dir = state.direction;
    document.dispatchEvent(new CustomEvent('tt:appearance', { detail: { ...state, picks } }));
  }

  function segmented(name, options, current, onPick) {
    const group = document.createElement('div');
    group.className = 'tt-seg';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label(option);
      button.setAttribute('aria-pressed', String(option === current));
      button.addEventListener('click', () => onPick(option));
      group.append(button);
    }
    return group;
  }

  function advanced(tokens, state, update) {
    const details = document.createElement('details');
    details.className = 'tt-switcher-advanced';
    details.open = Boolean(state.advancedOpen);
    details.addEventListener('toggle', () => { state.advancedOpen = details.open; write(state); });
    const summary = document.createElement('summary');
    summary.textContent = 'Token sets';
    details.append(summary);
    const defaults = tokens.theme[state.theme].defaults;
    for (const group of Object.keys(WRITERS)) {
      const row = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = label(group);
      const select = document.createElement('select');
      const themeDefault = document.createElement('option');
      themeDefault.value = '';
      themeDefault.textContent = `Theme default (${defaults[group].$value})`;
      select.append(themeDefault);
      for (const impl of keys(tokens.set[group])) {
        const option = document.createElement('option');
        option.value = impl;
        option.textContent = label(impl);
        select.append(option);
      }
      select.value = state.overrides[group] ?? '';
      select.addEventListener('change', () => update({ overrides: { ...state.overrides, [group]: select.value || null } }));
      row.append(text, select);
      details.append(row);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'tt-btn tt-btn--sm tt-btn--secondary';
    reset.textContent = 'Reset to theme defaults';
    reset.addEventListener('click', () => update({ overrides: {} }));
    details.append(reset);
    return details;
  }

  function mountSwitcher(tokens, state, update) {
    let bar = document.querySelector('.tt-switcher');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'tt-switcher';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Appearance');
      document.body.append(bar);
    }
    bar.replaceChildren(
      segmented('Theme', keys(tokens.theme), state.theme, (theme) => update({ theme })),
      segmented('Mode', MODES, state.mode, (mode) => update({ mode })),
      segmented('Direction', DIRECTIONS, state.direction, (direction) => update({ direction })),
      segmented('Motion', keys(tokens.set.motion), chosen(tokens, state).motion, (motion) =>
        update({ overrides: { ...state.overrides, motion } }),
      ),
      advanced(tokens, state, update),
    );
  }

  // The sliding selection indicator: SegmentedControl's thumb, the Tabs underline and a single-select ChipGroup's
  // pill. One element per group moves to the selected option instead of each option painting its own state.
  // Groups with one selected option: SegmentedControl (buttons or native radios), Tabs, a single-select ChipGroup,
  // and navigation lists, where the selected option is the link to the current page.
  const SLIDE_GROUPS = '.tt-seg, .tt-segmented, .s-seg, .tt-tabs, .tt-chipbar, .tt-rail, .s-nav, .pg-nav, [data-slide]';
  const SELECTED = '[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [aria-current="page"], input:checked';
  const optionOf = (element) => (element.matches('input') ? element.closest('label') ?? element : element);

  function placeIndicator(group) {
    const selected = group.querySelectorAll(SELECTED);
    const indicator = group.querySelector(':scope > .tt-slide');
    if (!indicator) return;
    if (selected.length !== 1) {
      indicator.hidden = true;
      group.removeAttribute('data-sliding');
      return;
    }
    const target = optionOf(selected[0]);
    indicator.hidden = false;
    group.toggleAttribute('data-focus-visible', target.matches(':focus-visible') || Boolean(target.querySelector(':focus-visible')));
    group.setAttribute('data-sliding', '');
    const underline = group.matches('.tt-tabs');
    indicator.style.inlineSize = `${target.offsetWidth}px`;
    if (!underline) indicator.style.blockSize = `${target.offsetHeight}px`;
    indicator.style.transform = `translate(${target.offsetLeft}px, ${underline ? 0 : target.offsetTop}px)`;
    if (!group.hasAttribute('data-slide-ready')) requestAnimationFrame(() => group.setAttribute('data-slide-ready', ''));
  }

  function enhanceSlider(group) {
    if (group.querySelector(':scope > .tt-slide')) return;
    const indicator = document.createElement('span');
    indicator.className = 'tt-slide';
    indicator.setAttribute('aria-hidden', 'true');
    group.append(indicator);
    const update = () => placeIndicator(group);
    new MutationObserver(update).observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current'] });
    new ResizeObserver(update).observe(group);
    group.addEventListener('change', update);
    group.addEventListener('focusin', update);
    group.addEventListener('focusout', () => requestAnimationFrame(update));
    update();
  }

  const enhanceAll = (root) => root.querySelectorAll?.(SLIDE_GROUPS).forEach(enhanceSlider);
  const startSliders = () => {
    enhanceAll(document);
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(SLIDE_GROUPS)) enhanceSlider(node);
        enhanceAll(node);
      }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('tt:appearance', () => document.querySelectorAll(SLIDE_GROUPS).forEach(placeIndicator));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSliders);
  else startSliders();

  const thumb = (c) =>
    `radial-gradient(120% 100% at 15% 10%, ${c[0]}cc 0%, transparent 55%), radial-gradient(90% 80% at 90% 100%, ${c[1]} 0%, transparent 62%), ${c[2]}`;
  const avatar = (c) => `linear-gradient(135deg, ${c[0]}, ${c[1]})`;

  const ready = fetch(tokensUrl)
    .then((response) => response.json())
    .then((tokens) => {
      const themes = keys(tokens.theme);
      const saved = read();
      const state = {
        theme: themes.includes(saved.theme) ? saved.theme : themes[0],
        mode: MODES.includes(saved.mode) ? saved.mode : 'dark',
        direction: DIRECTIONS.includes(saved.direction) ? saved.direction : 'ltr',
        overrides: saved.overrides && typeof saved.overrides === 'object' ? saved.overrides : {},
        advancedOpen: Boolean(saved.advancedOpen),
      };
      const update = (patch) => {
        Object.assign(state, patch);
        write(state);
        apply(tokens, state);
        mountSwitcher(tokens, state, update);
      };
      apply(tokens, state);
      mountSwitcher(tokens, state, update);
      return {
        tokens,
        state,
        update,
        roles: () => rolesFor(tokens, state.theme, state.mode),
        picks: () => chosen(tokens, state),
        resolve: (value) => resolve(tokens, value),
      };
    })
    .catch((error) => {
      const note = document.createElement('p');
      note.className = 'tt-load-error';
      note.textContent = 'Could not read tokens.json. Serve docs/design over HTTP: python3 -m http.server -d docs/design 8123';
      document.body.prepend(note);
      throw error;
    });

  window.TT = { ready, thumb, avatar };
})();
