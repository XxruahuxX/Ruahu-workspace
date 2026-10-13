import { icon } from './icons.js';
import { toast, form, menu } from './ui.js';
import { store } from './store.js';
import * as Term from './terminal.js';
import * as Editor from './editor.js';

const MAX_PANES = 4;
const cfg = await window.zona.getConfig();

// ---------- Módulos: webs + navegador libre + editor ----------
const BUILTIN = [
  { id: 'web', name: 'Navegador', kind: 'site', url: 'https://www.google.com', icon: 'globe' },
  { id: 'editor', name: 'Código', kind: 'editor', icon: 'code' }
];
const modules = () => [...cfg.sites.map((s) => ({ ...s, kind: 'site' })), ...BUILTIN];
const mod = (id) => modules().find((m) => m.id === id);
const favicon = (url) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ''; }
};
const modIcon = (m, size = 18) => (m.icon ? icon(m.icon, size)
  : `<img class="fav" src="${favicon(m.url)}" data-letter="${m.name[0]?.toUpperCase() || '?'}" width="${size}" height="${size}" alt="">`);

// Si un icono no carga (sin internet), se muestra la inicial de la web.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.letter) return;
  const span = document.createElement('span');
  span.className = 'letter';
  span.textContent = img.dataset.letter;
  span.style.width = span.style.height = img.width + 'px';
  img.replaceWith(span);
}, true);

// ---------- Plantillas de trabajo ----------
const PRESETS = [
  { id: 'estudiar', name: 'Estudiar', panes: ['canvas', 'notion'], dock: false },
  { id: 'programar', name: 'Programar', panes: ['editor', 'claude'], dock: true },
  { id: 'apuntes', name: 'Apuntes', panes: ['notion', 'claude'], dock: false }
];

// ---------- Estado ----------
let state = store.get('layout') || { panes: ['notion'], sizes: [1], focus: 0, dock: { open: false, h: 260 } };
function sanitize() {
  state.panes = state.panes.filter((id) => mod(id));
  if (!state.panes.length) state.panes = [modules()[0].id];
  if (state.sizes.length !== state.panes.length) state.sizes = state.panes.map(() => 1);
  state.focus = Math.min(state.focus, state.panes.length - 1);
}
sanitize();
const saveState = () => store.set('layout', state);

// ---------- Elementos de cada módulo (se crean al usarlos por primera vez) ----------
const stage = document.getElementById('stage');
const panesEl = document.getElementById('panes');
const els = new Map();

function element(id) {
  if (els.has(id)) return els.get(id);
  const m = mod(id);
  let el;
  if (m.kind === 'editor') {
    el = Editor.mount({ store, platform: cfg.platform, shell: cfg.shell, runInTerminal, askClaude });
  } else {
    el = document.createElement('webview');
    el.className = 'module';
    el.setAttribute('partition', 'persist:zona');
    el.setAttribute('allowpopups', '');
    el.src = m.url;
    const update = () => updateHeader(id);
    ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'page-title-updated'].forEach((ev) => el.addEventListener(ev, update));
    el.addEventListener('dom-ready', () => { el.dataset.ready = '1'; }, { once: true });
    el.addEventListener('focus', () => focusPane(state.panes.indexOf(id), false));
  }
  el.dataset.module = id;
  stage.appendChild(el);
  els.set(id, el);
  return el;
}

// ---------- Paneles ----------
function render() {
  panesEl.innerHTML = '';
  state.panes.forEach((id, i) => {
    if (i > 0) {
      const sp = document.createElement('div');
      sp.className = 'splitter v';
      sp.onmousedown = (e) => dragPanes(e, i - 1);
      panesEl.appendChild(sp);
    }
    const pane = document.createElement('section');
    pane.className = 'pane' + (i === state.focus ? ' focused' : '');
    pane.style.flex = `${state.sizes[i]} 1 0`;
    pane.dataset.index = i;
    pane.innerHTML = '<header class="pane-head"></header><div class="pane-body"></div>';
    pane.addEventListener('mousedown', () => focusPane(i, false));
    panesEl.appendChild(pane);
    buildHeader(pane.querySelector('.pane-head'), id, i);
  });
  renderSidebar();
  renderPresets();
  place();
  saveState();
}

function buildHeader(head, id, i) {
  const m = mod(id);
  head.innerHTML = `
    <button class="mod-pick" title="Cambiar lo que se ve en este panel">${modIcon(m, 16)}<span></span>${icon('down', 13)}</button>
    ${m.kind === 'site' ? `
      <div class="nav">
        <button class="icon-btn" data-nav="back" title="Atrás">${icon('left')}</button>
        <button class="icon-btn" data-nav="forward" title="Adelante">${icon('right')}</button>
        <button class="icon-btn" data-nav="reload" title="Recargar">${icon('reload')}</button>
      </div>
      <div class="address"><span class="spinner"></span><input spellcheck="false" placeholder="Escribe una dirección o búsqueda"></div>
      <button class="icon-btn" data-nav="external" title="Abrir en el navegador">${icon('external')}</button>` : '<div class="grow"></div>'}
    <button class="icon-btn" data-nav="split" title="Abrir otro panel al lado">${icon('split')}</button>
    ${state.panes.length > 1 ? `<button class="icon-btn" data-nav="close" title="Cerrar panel">${icon('x')}</button>` : ''}`;
  head.querySelector('.mod-pick span').textContent = m.name;
  head.querySelector('.mod-pick').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    menu(r.left, r.bottom + 4, modules().map((x) => ({
      label: x.name,
      icon: x.icon,
      img: x.icon ? null : favicon(x.url),
      letter: x.name[0]?.toUpperCase(),
      active: x.id === id,
      onClick: () => assign(i, x.id)
    })));
  };
  head.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => navAction(b.dataset.nav, id, i)));
  const input = head.querySelector('.address input');
  if (input) {
    input.onfocus = () => input.select();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { navigate(id, input.value); input.blur(); }
      if (e.key === 'Escape') { input.blur(); updateHeader(id); }
    };
    input.onblur = () => updateHeader(id);
  }
  updateHeader(id);
}

function updateHeader(id) {
  const i = state.panes.indexOf(id);
  if (i < 0) return;
  const head = panesEl.querySelector(`.pane[data-index="${i}"] .pane-head`);
  const wv = els.get(id);
  const input = head?.querySelector('.address input');
  if (!input || !wv) return;
  let url = wv.src;
  let loading = false;
  try { url = wv.getURL() || url; loading = wv.isLoading(); } catch {}
  if (document.activeElement !== input) input.value = url;
  head.querySelector('.address').classList.toggle('loading', loading);
  head.querySelector('.address').classList.toggle('secure', url.startsWith('https:'));
}

function navigate(id, text) {
  text = text.trim();
  if (!text) return;
  let url = text;
  if (!/^[a-z]+:\/\//i.test(text)) {
    url = /\s/.test(text) || !/\.[a-z]{2,}/i.test(text)
      ? 'https://www.google.com/search?q=' + encodeURIComponent(text)
      : 'https://' + text;
  }
  load(id, url);
}

function load(id, url) {
  const el = element(id);
  if (el.dataset.ready) el.loadURL(url);
  else el.src = url;
}

function navAction(act, id, i) {
  if (act === 'split') return split(i);
  if (act === 'close') return closePane(i);
  const wv = els.get(id);
  if (!wv?.dataset.ready) return;
  if (act === 'back' && wv.canGoBack()) wv.goBack();
  if (act === 'forward' && wv.canGoForward()) wv.goForward();
  if (act === 'reload') wv.reload();
  if (act === 'external') window.zona.openExternal(wv.getURL());
}

// Coloca cada módulo encima del hueco de su panel. Así nunca se recargan al moverlos.
function place() {
  const base = stage.getBoundingClientRect();
  const shown = new Set(state.panes);
  state.panes.forEach((id, i) => {
    const body = panesEl.querySelector(`.pane[data-index="${i}"] .pane-body`);
    const r = body.getBoundingClientRect();
    const el = element(id);
    Object.assign(el.style, { left: r.left - base.left + 'px', top: r.top - base.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    el.classList.add('visible');
  });
  els.forEach((el, id) => { if (!shown.has(id)) el.classList.remove('visible'); });
}

function focusPane(i, rerender = true) {
  if (i < 0 || i === state.focus) return;
  state.focus = i;
  panesEl.querySelectorAll('.pane').forEach((p) => p.classList.toggle('focused', +p.dataset.index === i));
  renderSidebar();
  saveState();
  if (rerender) render();
}

function assign(i, id) {
  const j = state.panes.indexOf(id);
  if (j >= 0 && j !== i) state.panes[j] = state.panes[i];   // intercambia
  state.panes[i] = id;
  state.focus = i;
  render();
}

// Abre un módulo: si ya se ve, lo enfoca; si se pide al lado, crea panel nuevo.
function show(id, { side = false } = {}) {
  const j = state.panes.indexOf(id);
  if (j >= 0) { focusPane(j); return j; }
  if (side && state.panes.length < MAX_PANES) {
    state.panes.splice(state.focus + 1, 0, id);
    state.sizes.splice(state.focus + 1, 0, state.sizes[state.focus] || 1);
    state.focus += 1;
  } else {
    state.panes[state.focus] = id;
  }
  render();
  return state.focus;
}

function split(i) {
  if (state.panes.length >= MAX_PANES) return toast(`Máximo ${MAX_PANES} paneles.`);
  const next = modules().find((m) => !state.panes.includes(m.id));
  if (!next) return;
  state.focus = i;
  show(next.id, { side: true });
}

function closePane(i) {
  if (state.panes.length < 2) return;
  state.panes.splice(i, 1);
  state.sizes.splice(i, 1);
  state.focus = Math.max(0, Math.min(state.focus, state.panes.length - 1));
  render();
}

function dragPanes(e, i) {
  e.preventDefault();
  const panes = [...panesEl.querySelectorAll('.pane')];
  const a = panes[i].getBoundingClientRect();
  const b = panes[i + 1].getBoundingClientRect();
  const total = state.sizes[i] + state.sizes[i + 1];
  document.body.classList.add('dragging', 'col-resize');
  const move = (ev) => {
    const x = Math.max(a.left + 240, Math.min(b.right - 240, ev.clientX));
    const ratio = (x - a.left) / (b.right - a.left);
    state.sizes[i] = total * ratio;
    state.sizes[i + 1] = total * (1 - ratio);
    panes[i].style.flex = `${state.sizes[i]} 1 0`;
    panes[i + 1].style.flex = `${state.sizes[i + 1]} 1 0`;
    place();
  };
  const up = () => {
    document.body.classList.remove('dragging', 'col-resize');
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    saveState();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
}

new ResizeObserver(() => place()).observe(panesEl);

// ---------- Barra lateral ----------
function renderSidebar() {
  const list = document.getElementById('mods');
  list.innerHTML = '';
  const add = (m) => {
    const b = document.createElement('button');
    b.className = 'side-btn';
    if (state.panes.includes(m.id)) b.classList.add('shown');
    if (state.panes[state.focus] === m.id) b.classList.add('active');
    b.innerHTML = modIcon(m, 20) + '<span class="tip"></span>';
    b.querySelector('.tip').textContent = m.name;
    b.onclick = (e) => show(m.id, { side: e.ctrlKey || e.shiftKey });
    b.onauxclick = (e) => { if (e.button === 1) show(m.id, { side: true }); };
    b.oncontextmenu = (e) => {
      const items = [
        { label: 'Abrir aquí', icon: 'layout', onClick: () => show(m.id) },
        { label: 'Abrir al lado', icon: 'split', onClick: () => show(m.id, { side: true }) }
      ];
      if (cfg.sites.some((s) => s.id === m.id)) {
        items.push('sep',
          { label: 'Editar', icon: 'settings', onClick: () => editSite(m.id) },
          { label: 'Quitar', icon: 'trash', danger: true, onClick: () => removeSite(m.id) });
      }
      menu(e.clientX, e.clientY, items);
    };
    list.appendChild(b);
  };
  cfg.sites.forEach((s) => add({ ...s, kind: 'site' }));
  list.appendChild(Object.assign(document.createElement('hr'), { className: 'side-sep' }));
  BUILTIN.forEach(add);
  document.getElementById('btn-dock').classList.toggle('active', state.dock.open);
}

function renderPresets() {
  const box = document.getElementById('presets');
  box.innerHTML = '';
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = p.name;
    const panes = p.panes.filter((id) => mod(id));
    if (panes.join() === state.panes.join() && p.dock === state.dock.open) b.classList.add('active');
    b.onclick = () => {
      state.panes = panes;
      state.sizes = panes.map(() => 1);
      state.focus = 0;
      setDock(p.dock);
      render();
    };
    box.appendChild(b);
  });
}

// ---------- Webs personalizadas ----------
async function addSite() {
  const r = await form('Añadir web', [
    { name: 'name', label: 'Nombre', placeholder: 'GitHub' },
    { name: 'url', label: 'Dirección', placeholder: 'https://github.com' }
  ], 'Añadir');
  if (!r) return;
  const url = /^https?:\/\//.test(r.url) ? r.url : 'https://' + r.url;
  const site = { id: 's' + Date.now().toString(36), name: r.name, url };
  cfg.sites.push(site);
  await window.zona.saveConfig(cfg);
  show(site.id);
}

async function editSite(id) {
  const s = cfg.sites.find((x) => x.id === id);
  const r = await form('Editar web', [
    { name: 'name', label: 'Nombre', value: s.name },
    { name: 'url', label: 'Dirección de inicio', value: s.url }
  ], 'Guardar');
  if (!r) return;
  s.name = r.name;
  s.url = /^https?:\/\//.test(r.url) ? r.url : 'https://' + r.url;
  await window.zona.saveConfig(cfg);
  render();
}

async function removeSite(id) {
  cfg.sites = cfg.sites.filter((x) => x.id !== id);
  await window.zona.saveConfig(cfg);
  els.get(id)?.remove();
  els.delete(id);
  const i = state.panes.indexOf(id);
  if (i >= 0) {
    if (state.panes.length > 1) { state.panes.splice(i, 1); state.sizes.splice(i, 1); }
    else state.panes[0] = 'web';
  }
  sanitize();
  render();
}

async function settings() {
  const r = await form('Ajustes', [
    { name: 'shell', label: 'Programa de la terminal (powershell.exe, pwsh.exe o cmd.exe)', value: cfg.shell }
  ], 'Guardar');
  if (!r) return;
  cfg.shell = r.shell.trim() || cfg.shell;
  await window.zona.saveConfig(cfg);
  toast('Guardado. Reinicia la terminal para aplicarlo.');
}

// ---------- Terminal inferior ----------
const dock = document.getElementById('dock');
async function setDock(open) {
  state.dock.open = open;
  dock.hidden = !open;
  dock.style.height = state.dock.h + 'px';
  document.getElementById('btn-dock').classList.toggle('active', open);
  saveState();
  if (open) {
    await Term.mount(document.getElementById('xterm'));
    Term.ensureStarted();
    Term.refit();
    Term.focus();
  }
  place();
}

document.getElementById('dock-split').onmousedown = (e) => {
  e.preventDefault();
  const bottom = dock.getBoundingClientRect().bottom;
  document.body.classList.add('dragging', 'row-resize');
  const move = (ev) => {
    state.dock.h = Math.max(120, Math.min(innerHeight - 200, bottom - ev.clientY));
    dock.style.height = state.dock.h + 'px';
  };
  const up = () => {
    document.body.classList.remove('dragging', 'row-resize');
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    saveState();
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
};

async function runInTerminal(cmd) {
  if (!state.dock.open) await setDock(true);
  Term.run(cmd);
}

// ---------- Relacionar módulos ----------
function claudeId() {
  return cfg.sites.find((s) => /claude\.ai/.test(s.url))?.id;
}

async function askClaude(text) {
  const id = claudeId();
  if (!id) return toast('Añade claude.ai como web para usar esto.');
  if (!state.panes.includes(id)) show(id, { side: true });
  else focusPane(state.panes.indexOf(id));
  const wv = element(id);
  const inject = async () => {
    try {
      return await wv.executeJavaScript(`(() => {
        const el = document.querySelector('div.ProseMirror[contenteditable="true"]') || document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
        if (!el) return false;
        el.focus();
        return document.execCommand('insertText', false, ${JSON.stringify(text)});
      })()`);
    } catch { return false; }
  };
  const done = () => inject().then(async (ok) => {
    if (ok) return toast('Enviado a Claude. Revisa y pulsa Enter.');
    await navigator.clipboard.writeText(text);
    toast('Copiado. Pégalo en Claude con Ctrl+V.');
  });
  if (wv.dataset.ready && !wv.isLoading()) done();
  else wv.addEventListener('did-stop-loading', done, { once: true });
}

// Enlace abierto desde una web: se abre en el navegador de la app, en otro panel.
function openLink(url) {
  show('web', { side: !state.panes.includes('web') });
  load('web', url);
}

window.zona.on('web:open-link', openLink);
window.zona.on('ask-claude', (t) => askClaude(t + '\n'));

// ---------- Botones y atajos ----------
document.getElementById('btn-add').onclick = addSite;
document.getElementById('btn-settings').onclick = settings;
document.getElementById('btn-dock').onclick = () => setDock(!state.dock.open);
document.getElementById('dock-restart').onclick = () => Term.restart();
document.getElementById('dock-close').onclick = () => setDock(false);
document.getElementById('btn-split').onclick = () => split(state.focus);

// Los atajos también llegan desde dentro de las webs (los reenvía main.js).
window.zona.on('shortcut', handleKey);
addEventListener('keydown', (e) => { if (handleKey(e)) e.preventDefault(); });

function handleKey(e) {
  if (!e.ctrlKey) return false;
  if (e.key === 'ñ' || e.key === 'Ñ' || e.code === 'Backquote') { setDock(!state.dock.open); return true; }
  if (e.key === '\\') { split(state.focus); return true; }
  if (e.key.toLowerCase() === 'w' && state.panes.length > 1) { closePane(state.focus); return true; }
  if (e.key >= '1' && e.key <= '9') {
    const m = modules()[+e.key - 1];
    if (m) { show(m.id, { side: e.shiftKey }); return true; }
  }
  return false;
}

// ---------- Arranque ----------
render();
if (state.dock.open) setDock(true);
else dock.hidden = true;
