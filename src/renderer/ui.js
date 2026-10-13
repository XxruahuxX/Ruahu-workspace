// Utilidades de interfaz: avisos, diálogos y menús.
import { icon } from './icons.js';

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

// Diálogo con campos. Devuelve un objeto con los valores o null si se cancela.
export function form(title, fields, okLabel = 'Aceptar') {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<form class="modal"><h2></h2><div class="fields"></div>
      <div class="actions"><button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary"></button></div></form>`;
    back.querySelector('h2').textContent = title;
    back.querySelector('[type=submit]').textContent = okLabel;
    const box = back.querySelector('.fields');
    fields.forEach((f) => {
      const l = document.createElement('label');
      l.innerHTML = '<span></span><input>';
      l.querySelector('span').textContent = f.label;
      const inp = l.querySelector('input');
      inp.name = f.name;
      inp.value = f.value || '';
      inp.placeholder = f.placeholder || '';
      inp.required = f.required !== false;
      box.appendChild(l);
    });
    const close = (v) => { back.remove(); document.body.classList.remove('modal-open'); resolve(v); };
    back.querySelector('[data-cancel]').onclick = () => close(null);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    back.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      close(Object.fromEntries(new FormData(e.target)));
    };
    document.body.classList.add('modal-open');
    document.body.appendChild(back);
    box.querySelector('input')?.focus();
  });
}

// Menú flotante. items: [{label, icon, onClick, danger}] o 'sep'.
export function menu(x, y, items) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  items.forEach((it) => {
    if (it === 'sep') { m.appendChild(Object.assign(document.createElement('hr'))); return; }
    const b = document.createElement('button');
    b.className = 'menu-item' + (it.danger ? ' danger' : '') + (it.active ? ' active' : '');
    b.innerHTML = (it.img ? `<img src="${it.img}" data-letter="${it.letter || '?'}" width="15" height="15" alt="">` : icon(it.icon || 'globe', 15)) + '<span></span>';
    b.querySelector('span').textContent = it.label;
    b.onclick = () => { closeMenu(); it.onClick(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  document.body.classList.add('menu-open');
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
}

function outside(e) { if (!e.target.closest('.menu')) closeMenu(); }

export function closeMenu() {
  document.querySelector('.menu')?.remove();
  document.body.classList.remove('menu-open');
  document.removeEventListener('mousedown', outside);
}
