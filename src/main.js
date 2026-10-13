const { app, BrowserWindow, ipcMain, shell, dialog, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const config = require('./config');

// Todas las webs comparten esta sesión: el login se guarda entre reinicios.
const PARTITION = 'persist:zona';

// Sin "Electron" en el user agent, Google y compañía no bloquean el login.
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '')
  .replace(/ zona-de-trabajo\/\S+/, '');

let win;
let term = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'Zona de trabajo',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      spellcheck: false
    }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'index.html'));
}

// Ventanas emergentes (login con Google, etc.) y menú contextual de las webs.
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;

  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (!/^https?:/.test(url)) return { action: 'deny' };
    // Enlaces normales con target=_blank: se abren en la propia app.
    if (disposition === 'foreground-tab' || disposition === 'background-tab') {
      win.webContents.send('web:open-link', url);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 600,
        height: 750,
        autoHideMenuBar: true,
        webPreferences: { partition: PARTITION }
      }
    };
  });

  // Atajos de la app aunque el foco esté dentro de una web.
  contents.on('before-input-event', (ev, input) => {
    if (input.type !== 'keyDown' || !input.control) return;
    if (/^[1-9]$/.test(input.key) || ['ñ', 'Ñ', '\\', 'w', 'W'].includes(input.key) || input.code === 'Backquote') {
      ev.preventDefault();
      win.webContents.send('shortcut', { ctrlKey: true, shiftKey: input.shift, key: input.key, code: input.code });
    }
  });

  contents.on('context-menu', (_ev, p) => {
    const items = [];
    if (p.linkURL) {
      items.push(
        { label: 'Abrir enlace en otro panel', click: () => win.webContents.send('web:open-link', p.linkURL) },
        { label: 'Abrir enlace en el navegador', click: () => shell.openExternal(p.linkURL) },
        { label: 'Copiar enlace', click: () => clipboard.writeText(p.linkURL) },
        { type: 'separator' }
      );
    }
    if (p.selectionText) {
      items.push({ label: 'Enviar selección a Claude', click: () => win.webContents.send('ask-claude', p.selectionText) });
    }
    items.push(
      { label: 'Cortar', role: 'cut', enabled: p.editFlags.canCut },
      { label: 'Copiar', role: 'copy', enabled: p.editFlags.canCopy },
      { label: 'Pegar', role: 'paste', enabled: p.editFlags.canPaste },
      { label: 'Seleccionar todo', role: 'selectAll' },
      { type: 'separator' },
      { label: 'Atrás', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Recargar', click: () => contents.reload() }
    );
    Menu.buildFromTemplate(items).popup();
  });
});

// ---------- Terminal ----------
function startTerminal(cols, rows, cwd) {
  stopTerminal();
  const cfg = config.load();
  const send = (data) => win && !win.isDestroyed() && win.webContents.send('term:data', data);
  const dir = cwd || os.homedir();
  try {
    const pty = require('node-pty');
    const p = pty.spawn(cfg.shell, [], { name: 'xterm-256color', cols, rows, cwd: dir, env: process.env });
    const me = { write: (d) => p.write(d), resize: (c, r) => p.resize(c, r), kill: () => p.kill() };
    p.onData((d) => term === me && send(d));
    p.onExit(() => term === me && send('\r\n\x1b[90m[Terminal cerrada. Pulsa reiniciar para abrir otra]\x1b[0m\r\n'));
    term = me;
  } catch (err) {
    // Plan B si node-pty no carga: proceso simple sin pseudo-terminal.
    const { spawn } = require('child_process');
    const p = spawn(cfg.shell, [], { cwd: dir, env: process.env });
    send(`[Modo básico: ${err.message}]\r\n`);
    const out = (d) => send(d.toString().replace(/\n/g, '\r\n'));
    p.stdout.on('data', out);
    p.stderr.on('data', out);
    p.on('exit', () => send('\r\n[Terminal cerrada]\r\n'));
    let line = '';
    term = {
      write: (d) => {
        for (const ch of d) {
          if (ch === '\r') { send('\r\n'); p.stdin.write(line + '\n'); line = ''; }
          else if (ch === '\x7f') { if (line) { line = line.slice(0, -1); send('\b \b'); } }
          else { line += ch; send(ch); }
        }
      },
      resize: () => {},
      kill: () => p.kill()
    };
  }
}

function stopTerminal() {
  if (term) { try { term.kill(); } catch {} term = null; }
}

ipcMain.on('term:start', (_e, cols, rows, cwd) => startTerminal(cols, rows, cwd));
ipcMain.on('term:input', (_e, data) => term && term.write(data));
ipcMain.on('term:resize', (_e, cols, rows) => term && term.resize(cols, rows));

// ---------- Archivos (editor de código) ----------
const IGNORED = new Set(['.git', 'node_modules', '.vs', '.idea', 'cmake-build-debug', '__pycache__']);

ipcMain.handle('fs:pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('fs:read-dir', async (_e, dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((d) => !IGNORED.has(d.name))
    .map((d) => ({ name: d.name, path: path.join(dir, d.name), dir: d.isDirectory() }))
    .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
});

ipcMain.handle('fs:read-file', (_e, file) => fs.readFile(file, 'utf8'));
ipcMain.handle('fs:write-file', (_e, file, text) => fs.writeFile(file, text, 'utf8'));
ipcMain.handle('fs:create', async (_e, target, isDir) => {
  if (isDir) await fs.mkdir(target, { recursive: true });
  else await fs.writeFile(target, '', { flag: 'wx' });
});

// ---------- Configuración ----------
ipcMain.handle('config:get', () => ({ ...config.load(), platform: process.platform }));
ipcMain.handle('config:save', (_e, cfg) => { delete cfg.platform; config.save(cfg); return true; });
ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopTerminal(); app.quit(); });
