const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const config = require('./config');

// Todas las webs comparten esta sesión: el login se guarda entre reinicios.
const PARTITION = 'persist:zona';

// Sin "Electron" en el user agent, Google y compañía no bloquean el login.
app.userAgentFallback = app.userAgentFallback.replace(/ Electron\/\S+/, '').replace(/ zona-de-trabajo\/\S+/, '');

let win;
let term = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Zona de trabajo',
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

// Ventanas emergentes de las webs (login con Google, etc.).
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    if (!/^https?:/.test(url)) return { action: 'deny' };
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
});

// ---------- Terminal ----------
function startTerminal(cols, rows) {
  stopTerminal();
  const cfg = config.load();
  const send = (data) => win && !win.isDestroyed() && win.webContents.send('term:data', data);
  try {
    const pty = require('node-pty');
    const p = pty.spawn(cfg.shell, [], {
      name: 'xterm-256color',
      cols, rows,
      cwd: os.homedir(),
      env: process.env
    });
    p.onData(send);
    p.onExit(() => send('\r\n[Terminal cerrada. Pulsa "Reiniciar" para abrir otra]\r\n'));
    term = { write: (d) => p.write(d), resize: (c, r) => p.resize(c, r), kill: () => p.kill() };
  } catch (err) {
    // Plan B si node-pty no carga: proceso simple sin pseudo-terminal.
    const { spawn } = require('child_process');
    const p = spawn(cfg.shell, [], { cwd: os.homedir(), env: process.env });
    send(`[Modo básico: ${err.message}]\r\n`);
    p.stdout.on('data', (d) => send(d.toString().replace(/\n/g, '\r\n')));
    p.stderr.on('data', (d) => send(d.toString().replace(/\n/g, '\r\n')));
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

ipcMain.on('term:start', (_e, cols, rows) => startTerminal(cols, rows));
ipcMain.on('term:input', (_e, data) => term && term.write(data));
ipcMain.on('term:resize', (_e, cols, rows) => term && term.resize(cols, rows));

// ---------- Configuración ----------
ipcMain.handle('config:get', () => config.load());
ipcMain.handle('config:save', (_e, cfg) => { config.save(cfg); return true; });
ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopTerminal(); app.quit(); });
