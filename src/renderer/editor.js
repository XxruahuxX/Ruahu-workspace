// Editor de código: explorador de archivos + Monaco (el editor de VS Code).
import { icon } from './icons.js';
import { form, toast } from './ui.js';

const VS = '../node_modules/monaco-editor/min/vs';
let api;           // funciones de la app: run, askClaude, store
let root, treeEl, tabsEl, hostEl, statusEl, emptyEl, titleEl;
let monaco, editor, monacoLoading;
const files = new Map();   // ruta -> { model, saved, tab }
let current = null;
let folder = null;

const sep = () => (api.platform === 'win32' ? '\\' : '/');
const base = (p) => p.split(/[\\/]/).pop();
const dirOf = (p) => p.slice(0, p.length - base(p).length - 1);

export function mount(app) {
  api = app;
  root = document.createElement('div');
  root.className = 'module editor-mod';
  root.innerHTML = `
    <aside class="explorer">
      <div class="explorer-head">
        <span class="explorer-title">Proyecto</span>
        <button class="icon-btn" data-act="new" title="Nuevo archivo">${icon('filePlus')}</button>
        <button class="icon-btn" data-act="refresh" title="Actualizar">${icon('reload')}</button>
        <button class="icon-btn" data-act="open" title="Abrir carpeta">${icon('folderOpen')}</button>
      </div>
      <div class="tree"></div>
    </aside>
    <section class="ed-main">
      <div class="ed-bar">
        <div class="ed-tabs"></div>
        <div class="ed-actions">
          <button class="btn ghost sm" data-act="claude" title="Enviar la selección o el archivo a Claude">${icon('sparkles', 14)}<span>Preguntar a Claude</span></button>
          <button class="btn primary sm" data-act="run" title="Guardar y ejecutar (F5)">${icon('play', 13)}<span>Ejecutar</span></button>
        </div>
      </div>
      <div class="ed-host"></div>
      <div class="ed-empty">
        <div class="empty-card">
          ${icon('code', 28)}
          <h3>Editor de código</h3>
          <p>Abre la carpeta de tu proyecto para ver sus archivos.<br>C, C++, Python, Java y JavaScript se ejecutan con F5.</p>
          <button class="btn primary" data-act="open">${icon('folderOpen', 15)}<span>Abrir carpeta</span></button>
        </div>
      </div>
      <div class="ed-status"><span class="st-file"></span><span class="st-pos"></span><span class="st-lang"></span></div>
    </section>`;
  treeEl = root.querySelector('.tree');
  tabsEl = root.querySelector('.ed-tabs');
  hostEl = root.querySelector('.ed-host');
  emptyEl = root.querySelector('.ed-empty');
  statusEl = root.querySelector('.ed-status');
  titleEl = root.querySelector('.explorer-title');

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    ({ open: pickFolder, refresh: refreshTree, new: newFile, run, claude: askClaude })[b.dataset.act]();
  });

  const saved = api.store.get('editor') || {};
  if (saved.folder) openFolder(saved.folder, saved.files || [], saved.current);
  else updateEmpty();
  return root;
}

// ---------- Monaco ----------
function loadMonaco() {
  if (monacoLoading) return monacoLoading;
  monacoLoading = new Promise((resolve, reject) => {
    window.MonacoEnvironment = { getWorkerUrl: () => `${VS}/base/worker/workerMain.js` };
    const s = document.createElement('script');
    s.src = `${VS}/loader.js`;
    s.onerror = reject;
    s.onload = () => {
      window.require.config({ paths: { vs: VS } });
      window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
    };
    document.head.appendChild(s);
  }).then((m) => {
    monaco = m;
    editor = monaco.editor.create(hostEl, {
      theme: 'vs',
      automaticLayout: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      renderLineHighlight: 'all',
      bracketPairColorization: { enabled: true },
      padding: { top: 10 }
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
    editor.addCommand(monaco.KeyCode.F5, () => run());
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F10, () => run());
    editor.onDidChangeCursorPosition((e) => {
      statusEl.querySelector('.st-pos').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });
    editor.onDidChangeModelContent(() => markDirty());
    return monaco;
  });
  return monacoLoading;
}

// ---------- Carpeta y árbol ----------
async function pickFolder() {
  const dir = await window.zona.fs.pickFolder();
  if (dir) openFolder(dir, [], null);
}

async function openFolder(dir, openList, active) {
  folder = dir;
  titleEl.textContent = base(dir) || dir;
  titleEl.title = dir;
  await refreshTree();
  for (const f of openList) await openFile(f, false);
  if (active && files.has(active)) activate(active);
  persist();
  updateEmpty();
}

async function refreshTree() {
  if (!folder) return;
  treeEl.innerHTML = '';
  try {
    await renderDir(treeEl, folder, 0);
  } catch (err) {
    toast('No se pudo leer la carpeta: ' + err.message);
  }
}

async function renderDir(container, dir, depth) {
  const entries = await window.zona.fs.readDir(dir);
  for (const ent of entries) {
    const row = document.createElement('div');
    row.className = 'tree-row' + (ent.dir ? ' dir' : '');
    row.style.paddingLeft = 8 + depth * 14 + 'px';
    row.dataset.path = ent.path;
    row.innerHTML = (ent.dir ? `<span class="chev">${icon('right', 12)}</span>${icon('folder', 15)}` : `<span class="chev"></span>${icon('file', 15)}`) + '<span class="name"></span>';
    row.querySelector('.name').textContent = ent.name;
    container.appendChild(row);
    if (ent.dir) {
      const kids = document.createElement('div');
      kids.className = 'tree-kids';
      kids.hidden = true;
      container.appendChild(kids);
      row.onclick = async () => {
        const open = kids.hidden;
        kids.hidden = !open;
        row.classList.toggle('open', open);
        if (open && !kids.dataset.loaded) {
          kids.dataset.loaded = '1';
          await renderDir(kids, ent.path, depth + 1);
        }
      };
    } else {
      row.onclick = () => openFile(ent.path);
    }
  }
}

async function newFile() {
  if (!folder) return pickFolder();
  const r = await form('Nuevo archivo', [{ name: 'name', label: 'Nombre', placeholder: 'main.cpp' }], 'Crear');
  if (!r) return;
  const target = folder + sep() + r.name.replace(/[\\/]/g, sep());
  try {
    await window.zona.fs.create(target, false);
  } catch (err) {
    return toast('No se pudo crear: ' + err.message);
  }
  await refreshTree();
  openFile(target);
}

// ---------- Pestañas y archivos ----------
async function openFile(path, focus = true) {
  await loadMonaco();
  if (!files.has(path)) {
    let text;
    try { text = await window.zona.fs.readFile(path); } catch { return; }
    const model = monaco.editor.createModel(text, undefined, monaco.Uri.file(path));
    const tab = document.createElement('div');
    tab.className = 'ed-tab';
    tab.title = path;
    tab.innerHTML = `<span class="name"></span><button class="close" title="Cerrar">${icon('x', 12)}</button>`;
    tab.querySelector('.name').textContent = base(path);
    tab.onclick = (e) => { if (!e.target.closest('.close')) activate(path); };
    tab.onauxclick = (e) => { if (e.button === 1) close(path); };
    tab.querySelector('.close').onclick = () => close(path);
    tabsEl.appendChild(tab);
    files.set(path, { model, saved: model.getAlternativeVersionId(), tab });
  }
  if (focus || !current) activate(path);
  persist();
}

function activate(path) {
  const f = files.get(path);
  if (!f) return;
  current = path;
  editor.setModel(f.model);
  files.forEach((x, p) => x.tab.classList.toggle('active', p === path));
  f.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  treeEl.querySelectorAll('.tree-row').forEach((r) => r.classList.toggle('selected', r.dataset.path === path));
  statusEl.querySelector('.st-file').textContent = path;
  statusEl.querySelector('.st-lang').textContent = f.model.getLanguageId();
  updateEmpty();
  editor.focus();
  persist();
}

function close(path) {
  const f = files.get(path);
  if (!f) return;
  if (isDirty(f)) {
    // Guardamos antes de cerrar para no perder nada.
    save(path);
  }
  f.tab.remove();
  f.model.dispose();
  files.delete(path);
  if (current === path) {
    current = null;
    const next = [...files.keys()].pop();
    if (next) activate(next);
    else editor.setModel(null);
  }
  updateEmpty();
  persist();
}

const isDirty = (f) => f.model.getAlternativeVersionId() !== f.saved;

function markDirty() {
  const f = files.get(current);
  if (f) f.tab.classList.toggle('dirty', isDirty(f));
}

async function save(path = current) {
  const f = files.get(path);
  if (!f) return;
  await window.zona.fs.writeFile(path, f.model.getValue());
  f.saved = f.model.getAlternativeVersionId();
  f.tab.classList.remove('dirty');
}

function updateEmpty() {
  const has = files.size > 0;
  emptyEl.hidden = has;
  hostEl.hidden = !has;
  statusEl.hidden = !has;
  if (!has) {
    emptyEl.querySelector('p').innerHTML = folder
      ? 'Elige un archivo en el panel de la izquierda<br>o crea uno nuevo.'
      : 'Abre la carpeta de tu proyecto para ver sus archivos.<br>C, C++, Python, Java y JavaScript se ejecutan con F5.';
    emptyEl.querySelector('button').hidden = !!folder;
  }
}

function persist() {
  api.store.set('editor', { folder, files: [...files.keys()], current });
}

// ---------- Ejecutar ----------
function runCommand(path) {
  const ps = /powershell|pwsh/i.test(api.shell);
  const name = base(path);
  const ext = name.split('.').pop().toLowerCase();
  const stem = name.slice(0, -(ext.length + 1));
  const q = (s) => (ps ? `"${s}"` : `'${s}'`);
  const exe = api.platform === 'win32' ? `${stem}.exe` : stem;
  const then = ps ? '; if ($?) { ' : ' && ';
  const end = ps ? ' }' : '';
  const runExe = ps ? `& ${q('.\\' + exe)}` : `./${q(exe)}`;
  const cmds = {
    c: `gcc -g ${q(name)} -o ${q(exe)}${then}${runExe}${end}`,
    cpp: `g++ -g -std=c++17 ${q(name)} -o ${q(exe)}${then}${runExe}${end}`,
    py: `python ${q(name)}`,
    js: `node ${q(name)}`,
    java: `javac ${q(name)}${then}java ${stem}${end}`,
    ps1: `& ${q('.\\' + name)}`,
    sh: `bash ${q(name)}`
  };
  cmds.cc = cmds.cxx = cmds.cpp;
  if (!cmds[ext]) return null;
  return `cd ${q(dirOf(path))}; ${cmds[ext]}`.replace('; ', ps ? '; ' : ' && ');
}

async function run() {
  if (!current) return toast('Abre un archivo para ejecutarlo.');
  await save();
  const cmd = runCommand(current);
  if (!cmd) return toast('No sé ejecutar este tipo de archivo.');
  api.runInTerminal(cmd);
}

function askClaude() {
  if (!current) return toast('Abre un archivo primero.');
  const sel = editor.getSelection();
  const model = editor.getModel();
  const code = sel && !sel.isEmpty() ? model.getValueInRange(sel) : model.getValue();
  api.askClaude(`Ayúdame con este código de ${base(current)}:\n\n\`\`\`${model.getLanguageId()}\n${code}\n\`\`\`\n`);
}

export function focus() { editor?.focus(); }
