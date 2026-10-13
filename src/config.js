// Configuración guardada en la carpeta de datos de la app (config.json).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  sites: [
    { id: 'notion', name: 'Notion', url: 'https://www.notion.so' },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai' },
    { id: 'canvas', name: 'Canvas', url: 'https://universidadeuropea.instructure.com' }
  ],
  shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
};

const file = () => path.join(app.getPath('userData'), 'config.json');

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cfg, null, 2));
}

module.exports = { load, save, DEFAULTS };
