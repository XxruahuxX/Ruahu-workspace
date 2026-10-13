// Terminal integrada (xterm.js + node-pty). Se crea la primera vez que se abre.
// xterm se carga en index.html antes que Monaco, porque el cargador AMD de Monaco choca con él.
let term, fit, host;
let started = false;
let ready = false;
let pending = [];

export async function mount(el) {
  host = el;
  if (term) return;
  term = new Terminal({
    fontFamily: '"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    allowProposedApi: true,
    theme: {
      background: '#ffffff', foreground: '#1f2328', cursor: '#2563eb', selectionBackground: '#cfe0ff',
      black: '#1f2328', red: '#cf222e', green: '#116329', yellow: '#9a6700', blue: '#0550ae',
      magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
      brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37', brightYellow: '#633c01',
      brightBlue: '#218bff', brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f'
    }
  });
  fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(host);
  term.onData((d) => window.zona.term.input(d));
  window.zona.term.onData((d) => {
    term.write(d);
    if (!ready) {
      ready = true;
      setTimeout(flush, 400);
    }
  });
  new ResizeObserver(() => resize()).observe(host);
}

function flush() {
  pending.forEach((c) => window.zona.term.input(c + '\r'));
  pending = [];
}

function resize() {
  if (!term || !host.offsetParent) return;
  fit.fit();
  if (started) window.zona.term.resize(term.cols, term.rows);
}

export function start(cwd) {
  if (!term) return;
  fit.fit();
  ready = false;
  started = true;
  window.zona.term.start(term.cols, term.rows, cwd);
}

export function ensureStarted(cwd) {
  if (!started) start(cwd);
}

export function restart() {
  if (!term) return;
  term.reset();
  start();
  term.focus();
}

// Escribe un comando en la terminal y lo ejecuta.
export function run(cmd) {
  if (!started) { pending.push(cmd); start(); return; }
  if (!ready) { pending.push(cmd); return; }
  window.zona.term.input(cmd + '\r');
  term.focus();
}

export function focus() { term?.focus(); }
export function refit() { resize(); }
