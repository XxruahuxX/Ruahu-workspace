# Zona de trabajo

App de escritorio para trabajar con todo a la vez: Notion, Claude, Canvas, un editor de código y una terminal, en paneles que puedes combinar.

Hecha con [Electron](https://www.electronjs.org/) (JavaScript).

## Requisitos

- Windows 10/11
- [Node.js](https://nodejs.org/) 20 o superior (versión LTS)
- Para compilar C/C++: `gcc`/`g++` en el PATH (por ejemplo, con [MSYS2](https://www.msys2.org/) o MinGW)

## Ejecutar

```powershell
git clone https://github.com/XxruahuxX/Ruahu-workspace.git
cd Ruahu-workspace
npm install
npm start
```

Si ya lo tenías clonado: `git pull`, `npm install` y `npm start`.

La primera vez tienes que iniciar sesión en cada web. La sesión se guarda.

## Qué tiene

- **Paneles combinables**: hasta 4 paneles lado a lado, con el ancho ajustable arrastrando el borde. Cada panel puede mostrar cualquier web o el editor.
- **Plantillas** arriba: *Estudiar* (Canvas + Notion), *Programar* (Código + Claude + terminal) y *Apuntes* (Notion + Claude).
- **Barra de dirección** en cada panel: escribe una URL o una búsqueda y pulsa Enter.
- **Más webs**: botón **+** de la barra lateral. Clic derecho en una web para editarla o quitarla.
- **Editor de código** (el mismo motor que VS Code): explorador de carpetas, pestañas, resaltado y autocompletado.
  - **Ejecutar** (F5 o Mayús+F10): guarda y ejecuta en la terminal. Soporta C, C++, Python, Java, JavaScript.
  - **Preguntar a Claude**: manda la selección (o el archivo entero) al panel de Claude.
- **Terminal** (PowerShell) abajo, redimensionable.
- **Relacionar webs**: clic derecho sobre un enlace → *Abrir enlace en otro panel*; sobre un texto seleccionado → *Enviar selección a Claude*.

## Atajos

| Atajo | Acción |
|-------|--------|
| Ctrl+1…9 | Abrir la web/módulo número N en el panel activo |
| Ctrl+Mayús+1…9 | Abrirlo en un panel nuevo al lado |
| Ctrl+clic en la barra lateral | Abrir al lado |
| Ctrl+\ | Dividir |
| Ctrl+W | Cerrar panel |
| Ctrl+Ñ | Mostrar u ocultar la terminal |
| Ctrl+S | Guardar archivo |
| F5 | Ejecutar archivo |

## Estructura

```
src/
  main.js          proceso principal: ventana, terminal, archivos, menús
  preload.js       puente seguro entre la interfaz y main.js
  config.js        lee y guarda config.json (webs y terminal)
  index.html       estructura de la interfaz
  styles.css       estilos
  renderer/
    app.js         paneles, barra lateral, plantillas, relación entre módulos
    editor.js      editor de código (Monaco) y explorador
    terminal.js    terminal (xterm.js)
    ui.js          menús, diálogos y avisos
    icons.js       iconos
    store.js       guarda la distribución de paneles
```

## Rendimiento

Cada web, el editor y la terminal se cargan solo la primera vez que los abres. Al moverlos entre paneles no se recargan.
