# Zona de trabajo

App de escritorio que junta en una sola ventana:

- 📝 **Notion** (apuntes)
- ✳️ **Claude** (claude.ai)
- 🎓 **Canvas** (campus virtual de la Universidad Europea)
- 💻 **Terminal** (PowerShell)

Hecha con [Electron](https://www.electronjs.org/) (JavaScript). Notion, Claude y Canvas no dejan meterse dentro de una web normal, y una web no puede abrir PowerShell. Electron sí puede las dos cosas.

## Requisitos

- Windows 10/11
- [Node.js](https://nodejs.org/) 20 o superior (versión LTS)

## Ejecutar

```powershell
git clone https://github.com/XxruahuxX/zona-de-trabajo.git
cd zona-de-trabajo
npm install
npm start
```

La primera vez tienes que iniciar sesión en cada web. La sesión se guarda para las siguientes.

## Uso

| Atajo | Pestaña |
|-------|---------|
| Ctrl+1 | Notion |
| Ctrl+2 | Claude |
| Ctrl+3 | Canvas |
| Ctrl+4 | Terminal |
| Ctrl+5 | Ajustes |

- La barra de arriba tiene atrás, adelante, recargar, inicio y abrir en el navegador.
- En **Ajustes** puedes cambiar la dirección de cada web (por ejemplo, la de tu Canvas) y el programa de la terminal (`powershell.exe`, `pwsh.exe` o `cmd.exe`). Reinicia la app después de guardar.

## Estructura

```
src/
  main.js       proceso principal: ventana, terminal, ajustes
  preload.js    puente seguro entre la ventana y main.js
  config.js     lee y guarda config.json
  index.html    interfaz
  renderer.js   lógica de la interfaz (pestañas, terminal, ajustes)
  styles.css    estilos
```

Para añadir otra web, añade una entrada en `sites` dentro de `src/config.js`.
