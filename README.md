# Super Optimizador

Aplicación portable de Super Optimizador, inspirada en la interfaz de la captura de
referencia. Incluye los menús principales, lecturas locales y un catálogo de ajustes.

Toda la interfaz está planteada como gratuita: no hay etiquetas Pro ni Beta.
La paleta usa azul cian, azul intenso, navy oscuro y amarillo como acento,
basada en la referencia Persona 3 enlazada.

Los sonidos locales están en `assets/`: `hover.wav` para pasar por los menús,
`section.wav` para cambiar de sección, `toggle.wav` para activar o desactivar
selectores y `click.wav` para botones de acción.

El overlay de rendimiento comienza desactivado y se controla desde el botón
`Overlay de FPS` de la esquina inferior izquierda; al activarlo muestra FPS, GPU, RAM libre y
temperatura, y usa `toggle.wav`. El botón de cierre del propio overlay también
lo desactiva.

## Versión portable de Windows

El proyecto incluye una envoltura Electron en `electron/`. Para generar el
portable desde Windows con Node.js instalado:

```powershell
npm install
npm run dist:portable
```

El resultado se crea en `dist/` como `Super-Optimizador-Portable-0.1.0.exe`.
El overlay de escritorio usa una ventana transparente independiente, se puede
mover arrastrando su cabecera y se crea únicamente cuando la opción está
activada. La RAM, GPU y temperatura se
consultan mediante `systeminformation` cuando el hardware expone esos datos.
El FPS se deja preparado para una integración de PresentMon o un proveedor
equivalente; algunas aplicaciones OpenGL pueden no entregar eventos de cuadros.

El portable incluye `tools/PresentMon-2.5.1-x64.exe`, descargado de la
distribución oficial de GameTechDev/PresentMon y verificado con SHA-256
`9BEC3083069F58F911E6A512F4806DB51A27BD096103087BC1D05EF54C80A191`.
Super Optimizador lo inicia únicamente mientras el overlay está activo y lo
detiene al apagarlo.

El Ping Monitor del portable ejecuta una medición ICMP real desde el equipo
hacia Google DNS (`8.8.8.8`), Cloudflare (`1.1.1.1`) y OpenDNS
(`208.67.222.222`).

El panel `Optimizar` también actualiza CPU y memoria usada con lecturas del
equipo cuando se ejecuta como portable; si un sensor térmico no está expuesto,
la temperatura se muestra como no disponible.

Las preferencias y los ajustes seleccionados se guardan localmente en el perfil
de la aplicación. La página principal muestra el catálogo completo por
categorías y permite seleccionar tweak por tweak. Cada tweak pide confirmación
individual; los cambios que necesitan elevación muestran UAC únicamente al
ejecutarse.

Antes de una aplicación se guarda un backup por ajuste en
`Documentos\Super Optimizador\Backups\optimizacion-...`. Si está activa la
preferencia correspondiente, también se intenta crear un punto de restauración
de Windows. Los ajustes reversibles aparecen en `Revertir` y pueden restaurarse
individualmente. Los ajustes irreversibles quedan marcados sin falsa opción de
reversión. Cada ejecución y reversión genera un TXT en
`Documentos\Super Optimizador\Logs`.

`Health Check` consulta memoria, almacenamiento, tiempo encendido y versión de
Windows en solo lectura. `Startup` consulta las entradas `Run` del usuario y del
equipo mediante `reg.exe`; todavía no desactiva aplicaciones ni cambia el registro.
`Drivers` muestra gráficos, sonido, red, procesador y placa base detectados, con
enlaces a las páginas oficiales de descarga según el fabricante.
`AI Scan` genera un informe local con memoria, inicio, temperatura, almacenamiento,
CPU, hardware y juegos.
El apartado `Limpiador de RAM` integra `ReduceMemory.exe`: con confirmación de
administrador ejecuta su modo silencioso `/O` para liberar working sets de
aplicaciones y servicios. La memoria puede volver a ocuparse después según la
demanda del sistema.

Para reducir el impacto en segundo plano, el overlay actualiza sus sensores
cada 2 segundos y evita iniciar una lectura nueva mientras la anterior sigue
pendiente. El panel principal solicita una lectura al entrar o volver a
`Optimizar`.

## Abrir

Abre `index.html` directamente en el navegador. También se puede servir desde
cualquier servidor local estático.

## Configuración de desarrollo y producción

La configuración de entorno está separada en `electron/config.js`. En desarrollo
usa `SUPER_OPTIMIZADOR_DEV_API_URL` o `http://127.0.0.1:3000`; en producción usa
`SUPER_OPTIMIZADOR_API_URL` y no tiene una URL remota predeterminada. Las
lecturas y acciones actuales siguen siendo locales y no dependen de una API.
