// Guarda el estado de la interfaz (paneles, editor...) en el navegador interno.
const KEY = 'zona.v2';
let data = {};
try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}

let timer;
export const store = {
  get: (k) => data[k],
  set: (k, v) => {
    data[k] = v;
    clearTimeout(timer);
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }, 300);
  }
};
