const tabsEl = document.getElementById('tabs');
const viewsEl = document.getElementById('views');
const urlEl = document.getElementById('url');
const webviews = {};
let current = null;
let termStarted = false;

// ---------- Pestañas ----------
function select(id) {
  current = id;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  const isWeb = id in webviews;
  document.body.classList.toggle('no-web', !isWeb);
  Object.entries(webviews).forEach(([key, wv]) => wv.classList.toggle('active', key === id));
  if (isWeb) updateUrl();
  if (id === 'terminal') openTerminal();
}

function updateUrl() {
  const wv = webviews[current];
  if (!wv) return;
  try { urlEl.textContent = wv.getURL(); } catch { urlEl.textContent = wv.src; }
}

function addTabButton(id, icon, label, title) {
  const b = document.createElement('button');
  b.className = 'tab';
  b.dataset.id = id;
  b.title = title;
  b.innerHTML = `<span>${icon}</span><small></small>`;
  b.querySelector('small').textContent = label;
  tabsEl.appendChild(b);
}

document.getElementById('sidebar').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) select(tab.dataset.id);
});

// ---------- Barra de navegación ----------
const wv = () => webviews[current];
document.getElementById('back').onclick = () => wv()?.canGoBack() && wv().goBack();
document.getElementById('forward').onclick = () => wv()?.canGoForward() && wv().goForward();
document.getElementById('reload').onclick = () => wv()?.reload();
document.getElementById('home').onclick = () => wv() && wv().loadURL(wv().dataset.home);
document.getElementById('external').onclick = () => wv() && window.zona.openExternal(wv().getURL());

// ---------- Terminal ----------
const term = new Terminal({
  fontFamily: 'Cascadia Mono, Consolas, monospace',
  fontSize: 14,
  cursorBlink: true,
  theme: { background: '#0c0c0c' }
});
const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
term.open(document.getElementById('xterm'));
term.onData((d) => window.zona.term.input(d));
window.zona.term.onData((d) => term.write(d));

function openTerminal() {
  requestAnimationFrame(() => {
    fit.fit();
    if (!termStarted) {
      window.zona.term.start(term.cols, term.rows);
      termStarted = true;
    }
    term.focus();
  });
}

document.getElementById('term-restart').onclick = () => {
  term.reset();
  window.zona.term.start(term.cols, term.rows);
  term.focus();
};

new ResizeObserver(() => {
  if (current !== 'terminal') return;
  fit.fit();
  window.zona.term.resize(term.cols, term.rows);
}).observe(document.getElementById('xterm'));

// ---------- Ajustes ----------
function renderSettings(cfg) {
  const form = document.getElementById('settings');
  form.innerHTML = '';
  cfg.sites.forEach((s, i) => {
    const label = document.createElement('label');
    label.textContent = `${s.icon} ${s.name}`;
    const input = document.createElement('input');
    input.value = s.url;
    input.dataset.index = i;
    form.append(label, input);
  });
  const sl = document.createElement('label');
  sl.textContent = '💻 Programa de la terminal (por ejemplo powershell.exe, pwsh.exe o cmd.exe)';
  const si = document.createElement('input');
  si.value = cfg.shell;
  si.id = 'shell';
  form.append(sl, si);
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Guardar';
  form.append(save);
  form.onsubmit = async (e) => {
    e.preventDefault();
    form.querySelectorAll('input[data-index]').forEach((inp) => { cfg.sites[inp.dataset.index].url = inp.value.trim(); });
    cfg.shell = si.value.trim();
    await window.zona.saveConfig(cfg);
    document.getElementById('saved').hidden = false;
  };
}

// ---------- Atajos: Ctrl+1..9 ----------
window.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.key < '1' || e.key > '9') return;
  const tab = document.querySelectorAll('.tab')[Number(e.key) - 1];
  if (tab) select(tab.dataset.id);
});

// ---------- Arranque ----------
(async () => {
  const cfg = await window.zona.getConfig();
  cfg.sites.forEach((s, i) => {
    addTabButton(s.id, s.icon, s.name, `${s.name} (Ctrl+${i + 1})`);
    const w = document.createElement('webview');
    w.src = s.url;
    w.dataset.home = s.url;
    w.setAttribute('partition', 'persist:zona');
    w.setAttribute('allowpopups', '');
    w.addEventListener('did-navigate', updateUrl);
    w.addEventListener('did-navigate-in-page', updateUrl);
    viewsEl.appendChild(w);
    webviews[s.id] = w;
  });
  document.querySelector('[data-id="terminal"]').title = `Terminal (Ctrl+${cfg.sites.length + 1})`;
  renderSettings(cfg);
  select(cfg.sites[0].id);
})();
