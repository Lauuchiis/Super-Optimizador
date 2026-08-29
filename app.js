const page = document.querySelector('#page');
const title = document.querySelector('#page-title');
const toast = document.querySelector('#toast');
const desktopBridge = window.superOptimizer;
const scrollDownButton = document.querySelector('#scroll-down-button');
let toastTimer;
let overlayEnabled = false;

const storageKey = 'super-optimizador-state-v1';
const optimizationCatalog = [
  { name: 'Rendimiento', description: 'Ajustes de energía, juegos, red y periféricos', options: [
    ['powerPlan', 'Plan de energía de alto rendimiento', 'Cambia el perfil de energía activo.'],
    ['gameBar', 'Deshabilitar Xbox Game Bar', 'Evita el overlay de capturas de Xbox en segundo plano.'],
    ['gameMode', 'Activar Modo Juego de Windows', 'Da prioridad a los procesos de juegos.'],
    ['networkThrottle', 'Corrección NetworkThrottlingIndex', 'Reduce la limitación multimedia de la red.'],
    ['disableMpo', 'Deshabilitar Multiplane Overlay (MPO)', 'Puede ayudar con parpadeos y stuttering gráfico.'],
    ['hags', 'Deshabilitar HAGS', 'Ajuste de planificación de GPU en Windows.'],
    ['powerThrottling', 'Deshabilitar limitación de energía', 'Evita reducir el rendimiento de procesos seleccionados.'],
    ['usbSuspend', 'Desactivar suspensión selectiva USB', 'Evita que Windows suspenda periféricos durante la sesión.']
  ]},
  { name: 'Servicios', description: 'Servicios que pueden trabajar en segundo plano', options: [
    ['sysMain', 'SysMain (Superfetch)', 'Reduce actividad de precarga en unidades SSD.'],
    ['searchIndex', 'Windows Search Indexing', 'Reduce el escaneo constante del indexador.'],
    ['telemetry', 'Telemetry (DiagTrack)', 'Limita la telemetría de diagnóstico en segundo plano.'],
    ['diagnostics', 'Diagnostic Policy Service', 'Desactiva los servicios de diagnóstico seleccionados.'],
    ['printSpooler', 'Print Spooler', 'Solo debe desactivarse si no se usa una impresora.'],
    ['disableWer', 'Windows Error Reporting', 'Evita tareas de informes de errores en segundo plano.']
  ]},
  { name: 'Limpieza y red', description: 'Mantenimiento temporal y resolución de red', options: [
    ['backgroundApps', 'Reducir aplicaciones en segundo plano', 'Limita aplicaciones modernas sin uso.'],
    ['tempClean', 'Limpiar archivos temporales', 'Borra temporales del usuario y del sistema.'],
    ['prefetch', 'Limpiar Temp y Prefetch', 'Limpia temporales y datos de precarga que Windows reconstruye.'],
    ['flushDns', 'Vaciar caché DNS', 'Fuerza una nueva resolución de nombres.'],
    ['winsockReset', 'Restablecer Winsock', 'Repara el catálogo de red de Windows.'],
    ['ipReset', 'Restablecer pila IP', 'Restablece parámetros TCP/IP.'],
    ['deliveryOptimization', 'Deshabilitar Delivery Optimization', 'Evita descargas compartidas de actualizaciones.'],
    ['disableHibernate', 'Deshabilitar hibernación', 'Libera el archivo de hibernación del disco.']
  ]},
  { name: 'Gaming y programación', description: 'Planificación de CPU y pantalla completa', options: [
    ['systemResponsiveness', 'Optimizar SystemResponsiveness', 'Ajusta la reserva multimedia del planificador.'],
    ['coreParking', 'Desactivar core parking', 'Mantiene todos los núcleos disponibles bajo carga.'],
    ['dynamicTick', 'Desactivar dynamic tick', 'Modifica el tick dinámico del temporizador.'],
    ['fullscreenOpt', 'Deshabilitar optimizaciones de pantalla completa', 'Deja el control de presentación al juego.'],
    ['gpuMsi', 'Activar GPU MSI mode', 'Ajuste avanzado para dispositivos GPU compatibles.'],
    ['pciAspm', 'Deshabilitar PCIe ASPM', 'Evita ahorro de energía del enlace PCIe.'],
    ['hpet', 'Deshabilitar HPET', 'Fuerza el temporizador TSC en equipos compatibles.'],
    ['timerResolution', 'Resolución del temporizador (1 ms)', 'Ajusta los intervalos del planificador de Windows.'],
    ['gamePriority', 'Vigilancia de prioridad del juego', 'Prepara la prioridad del proceso detectado.']
  ]},
  { name: 'Privacidad y Windows', description: 'Componentes opcionales y recopilación de datos', options: [
    ['copilot', 'Deshabilitar Windows Copilot', 'Oculta la integración opcional de Copilot.'],
    ['advertisingId', 'Deshabilitar Advertising ID', 'Desactiva el identificador publicitario de Windows.'],
    ['activityHistory', 'Deshabilitar Activity History', 'Limita el historial de actividad local.'],
    ['tailoredExp', 'Deshabilitar Tailored Experiences', 'Limita experiencias personalizadas.'],
    ['diagnosticData', 'Usar datos de diagnóstico mínimos', 'Reduce la recopilación opcional.'],
    ['visualEffects', 'Optimizar efectos visuales', 'Reduce animaciones y conserva texto y miniaturas.'],
    ['widgets', 'Deshabilitar Widgets', 'Oculta el panel de widgets de Windows.'],
    ['classicContextMenu', 'Restaurar menú contextual clásico', 'Usa el menú contextual tradicional.'],
    ['transparency', 'Deshabilitar efectos de transparencia', 'Reduce efectos visuales del escritorio.'],
    ['notifications', 'Reducir notificaciones', 'Limita interrupciones durante el juego.'],
    ['focusAssist', 'Activar Asistencia de concentración', 'Prioriza la sesión activa frente a avisos.'],
    ['oneDriveDisable', 'Deshabilitar inicio de OneDrive', 'Evita su arranque automático.'],
    ['startupCleanup', 'Limpiar accesos de inicio', 'Retira accesos no deseados de carpetas de inicio.']
  ]},
  { name: 'Entrada', description: 'Ratón y teclado', options: [
    ['mouseAccel', 'Deshabilitar aceleración del ratón', 'Mantiene una respuesta más lineal.'],
    ['mouseSpeed', 'Ajustar velocidad del ratón', 'Usa el nivel estándar 6/11 de Windows.'],
    ['pointerPrecision', 'Deshabilitar precisión mejorada', 'Evita aceleración adicional del puntero.'],
    ['keyboardRepeat', 'Acelerar repetición del teclado', 'Reduce el retraso de repetición.'],
    ['filterKeys', 'Deshabilitar Filter Keys', 'Evita filtros de pulsaciones accidentales.'],
    ['stickyKeys', 'Deshabilitar Sticky Keys', 'Evita el aviso de teclas especiales.']
  ]},
  { name: 'Aplicaciones opcionales', description: 'Elementos que requieren revisión individual', options: [
    ['oneDriveRemove', 'Eliminar OneDrive', 'Desinstala OneDrive por completo; guarda antes tus archivos.'],
    ['removeMcafee', 'Eliminar McAfee', 'Ejecuta la herramienta oficial de eliminación y puede requerir reinicio.'],
    ['cortana', 'Eliminar Cortana', 'Quita el asistente de voz opcional de Microsoft.'],
    ['bingApps', 'Eliminar Bing News y Weather', 'Quita aplicaciones opcionales de noticias y clima.'],
    ['teamsConsumer', 'Eliminar Teams personal', 'Quita la versión personal, no la empresarial.'],
    ['mixedReality', 'Eliminar Mixed Reality Portal', 'Quita el acompañante de dispositivos de realidad virtual.'],
    ['viewer3d', 'Eliminar Visor 3D', 'Quita el visor 3D preinstalado.'],
    ['solitaire', 'Eliminar Solitaire Collection', 'Quita los juegos de cartas preinstalados.'],
    ['skypeOffice', 'Eliminar Skype y Office Hub', 'Quita aplicaciones opcionales relacionadas.'],
    ['clipchamp', 'Eliminar Clipchamp', 'Quita el editor de vídeo incluido en Windows 11.'],
    ['familySafety', 'Eliminar Family Safety', 'Quita la aplicación opcional de seguridad familiar.'],
    ['feedbackHub', 'Eliminar Centro de opiniones', 'Quita el centro de comentarios de Windows.'],
    ['mailCalendar', 'Eliminar Correo y Calendario', 'Quita Correo, Calendario y el nuevo Outlook.'],
    ['maps', 'Eliminar Mapas', 'Quita Microsoft Maps.'],
    ['moviesTV', 'Eliminar Películas y TV', 'Quita el reproductor incluido.'],
    ['paint3d', 'Eliminar Paint 3D', 'Quita Paint 3D y conserva Paint clásico.'],
    ['people', 'Eliminar Contactos', 'Quita Microsoft People.'],
    ['powerAutomate', 'Eliminar Power Automate', 'Quita Power Automate Desktop.'],
    ['tips', 'Eliminar Consejos', 'Quita Consejos y Primeros pasos.'],
    ['toDo', 'Eliminar Microsoft To Do', 'Quita To Do si usas otra aplicación.'],
    ['weather', 'Eliminar Weather', 'Quita Microsoft Weather.'],
    ['yourPhone', 'Eliminar Phone Link', 'Quita la vinculación con el teléfono.'],
    ['xboxApp', 'Eliminar Xbox App', 'Quita Xbox y servicios relacionados; revisa si usas Game Pass.'],
    ['devHome', 'Eliminar Dev Home', 'Quita la aplicación de desarrollo de Microsoft.'],
    ['getHelp', 'Eliminar Obtener ayuda', 'Quita la aplicación integrada de soporte.'],
    ['quickAssist', 'Eliminar Asistencia rápida', 'Quita la aplicación de soporte remoto.'],
    ['crossDevice', 'Eliminar Cross Device Experience Host', 'Quita funciones de vinculación y uso compartido cercano.'],
    ['stickyNotes', 'Eliminar Notas rápidas', 'Quita Sticky Notes.'],
    ['soundRecorder', 'Eliminar Grabadora de sonido', 'Quita la grabadora de voz integrada.'],
    ['alarmsClock', 'Eliminar Alarmas y reloj', 'Quita la aplicación de alarmas.'],
    ['paintApp', 'Eliminar Paint moderno', 'Quita Paint moderno; se puede reinstalar desde Microsoft Store.'],
    ['notepadApp', 'Eliminar Bloc de notas', 'Quita el editor predeterminado; requiere reinstalarlo si se necesita.'],
    ['snipSketch', 'Eliminar Recortes', 'Quita la herramienta de capturas.'],
    ['calculatorApp', 'Eliminar Calculadora', 'Quita la calculadora integrada.'],
    ['photosApp', 'Eliminar Fotos', 'Quita el visor de fotos integrado.'],
    ['bingSearch', 'Eliminar componente Bing Search', 'Quita Bing Search sin afectar Windows Search.'],
    ['zuneMusic', 'Eliminar Groove Music', 'Quita el reproductor de música integrado.'],
    ['startExperiences', 'Eliminar recomendaciones del menú Inicio', 'Quita el componente de recomendaciones del menú Inicio.']
  ]}
];
const optimizationCount = optimizationCatalog.reduce((total, group) => total + group.options.length, 0);
const dnsProfiles = [
  { name: 'Google DNS', primary: '8.8.8.8', secondary: '8.8.4.4', sample: 24 },
  { name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', sample: 18 },
  { name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220', sample: 31 }
];
const gameProfiles = [
  { id: 'minecraft', name: 'Minecraft Java', process: 'javaw.exe', path: '%APPDATA%\\.minecraft', file: 'options.txt / config', config: ['Distancia de renderizado equilibrada', 'VSync desactivado si el monitor usa VRR', 'Límite de FPS igual a la frecuencia del monitor'] },
  { id: 'cs2', name: 'Counter-Strike 2', process: 'cs2.exe', path: 'Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg', file: 'autoexec.cfg', config: ['fps_max 0', 'Desactivar aceleración del ratón', 'Perfil de red y audio competitivo'] },
  { id: 'peak', name: 'PEAK', process: 'PEAK.exe', path: 'Perfil local del juego', file: 'Configuración del juego', config: ['Calidad ajustada a la GPU disponible', 'Límite de FPS estable', 'Reducir efectos si aparecen tirones'] },
  { id: 'roblox', name: 'Roblox', process: 'RobloxPlayerBeta.exe', path: '%LOCALAPPDATA%\\Roblox', file: 'Perfil gráfico local', config: ['Calidad manual según la carga', 'Limitar FPS con una herramienta externa compatible', 'Desactivar capturas en segundo plano'] },
  { id: 'genshin', name: 'Genshin Impact', process: 'GenshinImpact.exe', path: 'Carpeta de instalación de Genshin Impact', file: 'Perfil gráfico', config: ['Resolución y sombras según VRAM', '60 FPS si la GPU mantiene estabilidad', 'Reducir reflejos antes que la resolución'] },
  { id: 'zzz', name: 'Zenless Zone Zero', process: 'ZenlessZoneZero.exe', path: 'Carpeta de instalación de Zenless Zone Zero', file: 'Perfil gráfico', config: ['Priorizar estabilidad de FPS', 'Reducir sombras y reflejos en GPU integrada', 'Mantener escalado y nitidez constantes'] }
];
const defaultState = {
  settings: {
    overlay: false,
    launchOnStartup: false,
    restorePoint: true,
    sound: true
  },
  startup: {
    Discord: true,
    Steam: true,
    OneDrive: true,
    'Windows Security': true
  },
  optimizations: {},
  log: []
};

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return {
      ...defaultState,
      ...stored,
      settings: { ...defaultState.settings, ...(stored?.settings || {}) },
      startup: { ...defaultState.startup, ...(stored?.startup || {}) },
      optimizations: { ...defaultState.optimizations, ...(stored?.optimizations || {}) },
      log: Array.isArray(stored?.log) ? stored.log.slice(0, 30) : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
overlayEnabled = Boolean(state.settings.overlay);

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
}

function addLog(titleText, detailText) {
  state.log.unshift({ title: titleText, detail: detailText, at: new Date().toISOString() });
  state.log = state.log.slice(0, 30);
  saveState();
}

function formatLogTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ahora';
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

const sounds = {
  hover: new Audio('./assets/hover.wav'),
  toggle: new Audio('./assets/toggle.wav'),
  click: new Audio('./assets/click.wav'),
  section: new Audio('./assets/section.wav')
};
Object.values(sounds).forEach(sound => {
  sound.preload = 'auto';
  sound.volume = 0.45;
});

function playSound(name) {
  if (state.settings.sound === false) return;
  const sound = sounds[name];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {
    // Browsers can block audio before the first user gesture; Electron will not.
  });
}

function optimizationGroupsMarkup(groups = optimizationCatalog) {
  return groups.map(group => `<section class="optimization-group"><div class="optimization-group-header"><div><h3>${escapeHtml(group.name)}</h3><small>${escapeHtml(group.description)} · ${group.options.length} opciones</small></div><button class="secondary" data-action="toggle-group" data-group-name="${escapeHtml(group.name)}">Activar todos</button></div><div class="optimization-options">${group.options.map(([key, label, description]) => `<label class="optimization-option"><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-optimization-key="${escapeHtml(key)}" ${isOptimizationSelected(key) ? 'checked' : ''}><i class="option-switch"></i></label>`).join('')}</div></section>`).join('');
}

const pages = {
  optimize: {
    title: 'Optimizar',
    render: () => `
      <div class="hero">
        <div class="hero-copy">
          <div class="hero-kicker">ANÁLISIS COMPLETADO</div>
          <h2>Tu PC está lista para mejorar</h2>
          <p>Super Optimizador encuentra ajustes seguros para reducir procesos en segundo plano y preparar tu equipo para jugar o trabajar.</p>
          <p class="hero-hint">Usa los pulsadores de cada sección para revisar y aplicar sus ajustes individualmente.</p>
        </div>
        <div class="hero-metric"><div class="gauge"><div class="gauge-value"><strong>74</strong><span>puntuación</span></div></div></div>
      </div>
      <div class="section-head"><h3>Estado del sistema</h3><div class="section-head-actions"><span>Último análisis: hace 2 min</span><button class="secondary compact-button" data-action="open-sensors">Ver sensores</button></div></div>
      <div class="cards system-cards">
        <div class="card"><div class="card-header"><span>Uso de CPU</span><span class="card-icon">◌</span></div><strong id="system-cpu">18%</strong><small id="system-cpu-detail">En reposo</small><div class="progress"><b id="system-cpu-bar" style="width:18%"></b></div></div>
        <div class="card"><div class="card-header"><span>Memoria RAM</span><span class="card-icon">▤</span></div><strong id="system-ram">7.2 GB</strong><small id="system-ram-detail">de 16 GB usados</small><div class="progress"><b id="system-ram-bar" style="width:45%"></b></div></div>
      </div>
      <div class="section-head"><h3>Optimizar Windows <span class="tag">${optimizationCount} disponibles</span></h3><span id="optimization-selection-count">0 seleccionados</span></div>
      <div class="optimization-inline-panel"><div class="optimization-inline-groups">${optimizationGroupsMarkup()}</div><div class="optimization-run-row"><div><strong>Aplicar selección</strong><small>Los tweaks marcados se ejecutarán juntos con permisos de administrador.</small></div><button class="primary" data-action="apply-optimization">Ejecutar optimizaciones seleccionadas</button></div></div>`
  },
  ai: { title: 'AI Scan', render: () => `
    <div class="page-title-card"><h2>Diagnóstico inteligente</h2><p>Analiza el estado básico del equipo para encontrar posibles cuellos de botella. La lectura se realiza localmente.</p><div class="toolbar"><button class="primary" data-action="ai-scan">Escanear sistema</button></div></div>
    <div class="section-head"><h3>Recomendaciones</h3><span id="ai-summary">Listo para escanear</span></div><div id="ai-results" class="list"><div class="card"><small>Pulsa «Escanear sistema» para obtener un informe actualizado.</small></div></div>` },
  games: { title: 'Juegos', render: () => `
    <div class="page-title-card"><h2>Perfiles de juego</h2><p>Selecciona un título para ver sus ajustes recomendados y la ubicación de su configuración. La detección actualiza automáticamente qué juego está activo.</p><div class="toolbar"><button class="primary" data-action="detect-games">Actualizar detección</button></div></div>
    <div class="section-head"><h3>Configuraciones disponibles</h3><span id="games-summary">Leyendo juegos…</span></div><div id="games-results" class="game-profile-grid">${gameProfiles.map(profile => `<article class="game-profile-card"><div class="game-profile-top"><span class="game-icon">🎮</span><div><h3>${escapeHtml(profile.name)}</h3><small>${escapeHtml(profile.process)}</small></div><span class="tag" data-game-status="${escapeHtml(profile.id)}">Perfil</span></div><p>${escapeHtml(profile.config[0])}. ${escapeHtml(profile.config[1])}.</p><button class="secondary" data-action="show-game-profile" data-profile-id="${escapeHtml(profile.id)}">Ver configuración</button></article>`).join('')}</div>` },
  drivers: { title: 'Drivers', render: () => `<div class="page-title-card"><h2>Centro de dispositivos</h2><p>Consulta gráficos, sonido, red, procesador y placa base detectados en este equipo. La lectura es local y no instala controladores.</p><div class="toolbar"><button class="primary" data-action="driver-scan">Actualizar lectura</button></div></div><div class="section-head"><h3>Dispositivos detectados</h3><span id="drivers-summary">Leyendo equipo…</span></div><div id="drivers-results" class="list"><div class="card"><small>Consultando los dispositivos del equipo…</small></div></div>` },
  health: { title: 'Health Check', render: () => `<div class="page-title-card"><h2>Salud del equipo</h2><p>Consulta indicadores básicos del sistema sin modificar archivos ni configuraciones.</p></div><div class="section-head"><h3>Comprobaciones</h3><span id="health-summary">Leyendo equipo…</span></div><div class="grid-two"><div class="card"><div class="card-header"><span>Memoria en uso</span><span class="tag">Lectura</span></div><strong id="health-memory">—</strong><small>Porcentaje de memoria ocupada</small></div><div class="card"><div class="card-header"><span>Almacenamiento</span><span class="tag">Lectura</span></div><strong id="health-storage">—</strong><small id="health-storage-detail">Comprobando unidad principal</small></div><div class="card"><div class="card-header"><span>Tiempo encendido</span><span class="tag">Lectura</span></div><strong id="health-uptime">—</strong><small>Sistema operativo: <span id="health-os">—</span></small></div><div class="card"><div class="card-header"><span>Alcance</span><span class="tag">Seguro</span></div><strong>Solo lectura</strong><small>No se ejecutan reparaciones automáticas</small></div></div>` },
  startup: { title: 'Startup', render: () => `<div class="page-title-card"><h2>Aplicaciones de inicio</h2><p>Consulta las aplicaciones registradas para iniciar con Windows. Esta vista es de solo lectura.</p></div><div class="section-head"><h3>Registros detectados</h3><span id="startup-summary">Leyendo registro…</span></div><div id="startup-results" class="list"><div class="card"><small>Consultando las claves de inicio del usuario y del equipo…</small></div></div>` },
  boost: { title: 'Limpiador de RAM', render: () => `<div class="hero memory-cleaner-hero"><div class="hero-copy"><div class="hero-kicker">MEMORIA DEL SISTEMA</div><h2>Limpiador de RAM</h2><p>ReduceMemory libera working sets de aplicaciones y servicios para recuperar memoria. La operación solicita permisos de administrador.</p><button class="primary" data-action="clean-memory">Limpiar RAM</button></div><div class="hero-metric"><div class="gauge memory-gauge" id="memory-cleaner-gauge"><div class="gauge-value"><strong id="memory-cleaner-percent">—</strong><span>RAM en uso</span></div></div></div></div>` },
  ping: { title: 'Monitor de ping', render: () => `<div class="page-title-card"><h2>Monitor de ping</h2><p>Mide la latencia y aplica el DNS elegido en el adaptador de red activo, ya sea Ethernet o Wi‑Fi.</p><div class="toolbar"><button class="primary" data-action="measure-ping">Medir ahora</button></div></div><div class="section-head"><h3>DNS públicos</h3><span id="ping-updated">Listo para medir</span></div><div id="dns-results" class="dns-grid">${dnsProfiles.map(dns=>`<div class="dns-card"><h4>${dns.name}</h4><small>${dns.primary} · ${dns.secondary}</small><div class="dns-ping"><strong data-ping-value="${dns.name}">${dns.sample}</strong><span>ms</span></div><div class="dns-bar"><b style="--ping-width:${Math.min(100, Number(dns.sample)*2.1)}%"></b></div><button class="secondary dns-apply-button" data-action="apply-dns" data-dns-name="${dns.name}" data-dns-primary="${dns.primary}" data-dns-secondary="${dns.secondary}">Aplicar en red activa</button></div>`).join('')}</div><div class="safe-note" style="margin-top:16px;text-align:left">${desktopBridge?.isDesktop ? 'La aplicación detectará la conexión activa y solicitará UAC antes de cambiarla.' : 'La aplicación portable aplica el DNS real; esta vista del navegador solo muestra datos de demostración.'}</div>` },
  log: { title: 'Log', render: () => `<div class="page-title-card"><h2>Registro de actividad</h2><p>Historial local de análisis y cambios realizados por Super Optimizador.</p><small id="log-path">Consultando carpeta de registros TXT…</small></div><div class="section-head"><h3>Actividad reciente</h3><button class="secondary" data-action="clear-log">Limpiar</button></div>${state.log.length ? `<div class="list">${state.log.map(entry => `<div class="list-item"><i class="status-dot"></i><div class="grow"><strong>${entry.title}</strong><small>${formatLogTime(entry.at)} · ${entry.detail}</small></div></div>`).join('')}</div>` : '<div class="card"><strong>No hay actividad registrada</strong><small>Las acciones seguras aparecerán aquí.</small></div>'}` },
  settings: { title: 'Ajustes', render: () => `<div class="page-title-card"><h2>Preferencias</h2><p>Configura el comportamiento de la aplicación y sus comprobaciones.</p><div class="setting-row"><div><strong>Iniciar con Windows</strong><small>Guardar la preferencia para futuras versiones del portable</small></div><button class="switch ${state.settings.launchOnStartup ? '' : 'off'}" data-setting="launchOnStartup" aria-label="Iniciar con Windows" aria-pressed="${state.settings.launchOnStartup}"></button></div><div class="setting-row"><div><strong>Crear punto de restauración</strong><small>Antes de aplicar ajustes del sistema</small></div><button class="switch ${state.settings.restorePoint ? '' : 'off'}" data-setting="restorePoint" aria-label="Crear punto de restauración" aria-pressed="${state.settings.restorePoint}"></button></div><div class="setting-row"><div><strong>Sonidos de interfaz</strong><small>Reproducir sonidos al navegar y activar opciones</small></div><button class="switch ${state.settings.sound ? '' : 'off'}" data-setting="sound" aria-label="Sonidos de interfaz" aria-pressed="${state.settings.sound}"></button></div></div>` },
  revert: { title: 'Revertir', render: () => `<div class="page-title-card"><h2>Revertir cambios</h2><p>Revierte individualmente los ajustes que tengan una copia de seguridad disponible.</p></div><div class="section-head"><h3>Sesiones registradas</h3><span id="revert-summary">Consultando backups…</span></div><div id="revert-results" class="list"><div class="card"><small>Consultando backups…</small></div></div>` }
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showActionConfirmation({ titleText, message, detail, confirmText = 'Continuar' }) {
  return new Promise(resolve => {
    document.querySelector('.action-confirm-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'action-confirm-modal';
    modal.innerHTML = `<div class="action-confirm-backdrop"></div><div class="action-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="action-confirm-title"><div class="action-confirm-icon">!</div><div class="action-confirm-copy"><p class="eyebrow">SUPER OPTIMIZADOR</p><h2 id="action-confirm-title">${escapeHtml(titleText)}</h2><p>${escapeHtml(message)}</p><small>${escapeHtml(detail)}</small></div><div class="action-confirm-footer"><button class="secondary" data-confirm-choice="cancel">Cancelar</button><button class="primary" data-confirm-choice="confirm">${escapeHtml(confirmText)}</button></div></div>`;
    const finish = accepted => {
      playSound('click');
      modal.remove();
      resolve(accepted);
    };
    modal.addEventListener('click', event => {
      event.stopPropagation();
      const choice = event.target.closest('[data-confirm-choice]')?.dataset.confirmChoice;
      if (choice) finish(choice === 'confirm');
      else if (event.target.classList.contains('action-confirm-backdrop')) finish(false);
    });
    document.body.append(modal);
  });
}

function showHardwareSensors() {
  document.querySelector('.sensor-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'sensor-modal';
  modal.innerHTML = `<div class="sensor-backdrop"></div><div class="sensor-dialog" role="dialog" aria-modal="true" aria-labelledby="sensor-title"><div class="sensor-dialog-header"><div><p class="eyebrow">LECTURA DEL EQUIPO</p><h2 id="sensor-title">Sensores del equipo</h2><p>Consulta las lecturas disponibles en esta PC.</p></div><button class="icon-button" data-sensor-action="close" aria-label="Cerrar">×</button></div><div class="sensor-grid"><div class="sensor-card"><span>Uso de CPU</span><strong id="sensor-cpu-load">—</strong><small>Procesador</small></div><div class="sensor-card"><span>Temperatura CPU</span><strong id="sensor-cpu-temperature">—</strong><small id="sensor-cpu-temperature-detail">Sin lectura disponible</small></div><div class="sensor-card"><span>Uso de GPU</span><strong id="sensor-gpu-load">—</strong><small>Gráfica principal</small></div><div class="sensor-card"><span>Temperatura GPU</span><strong id="sensor-gpu-temperature">—</strong><small id="sensor-gpu-temperature-detail">Sin lectura disponible</small></div><div class="sensor-card sensor-card-wide"><span>RAM libre</span><strong id="sensor-ram-free">—</strong><small>Memoria disponible ahora</small></div></div><div class="sensor-dialog-footer"><small id="sensor-status">Consultando lecturas…</small><div><button class="secondary" data-sensor-action="refresh">Actualizar</button><button class="primary" data-sensor-action="close">Cerrar</button></div></div></div>`;
  const setText = (selector, value) => {
    const element = modal.querySelector(selector);
    if (element) element.textContent = value;
  };
  const displayTemperature = value => value && value !== '—' ? value : 'No disponible';
  const refresh = async () => {
    setText('#sensor-status', 'Consultando lecturas…');
    try {
      const metrics = await desktopBridge.getMetrics();
      setText('#sensor-cpu-load', metrics.cpu || '—');
      setText('#sensor-cpu-temperature', displayTemperature(metrics.temperature));
      setText('#sensor-cpu-temperature-detail', metrics.temperature === '—' ? 'No expuesto por el equipo' : `Fuente: ${metrics.temperatureSource || 'LibreHardwareMonitor'}`);
      setText('#sensor-gpu-load', metrics.gpu || '—');
      setText('#sensor-gpu-temperature', displayTemperature(metrics.gpuTemperature));
      setText('#sensor-gpu-temperature-detail', metrics.gpuTemperature === '—' ? 'No expuesto por el equipo' : 'Fuente: LibreHardwareMonitor');
      setText('#sensor-ram-free', metrics.ram || '—');
      setText('#sensor-status', 'Última lectura: ahora');
    } catch {
      setText('#sensor-status', 'No se pudieron consultar las lecturas.');
    }
  };
  modal.addEventListener('click', event => {
    event.stopPropagation();
    const action = event.target.closest('[data-sensor-action]')?.dataset.sensorAction;
    if (action === 'close' || event.target.classList.contains('sensor-backdrop')) {
      playSound('click');
      modal.remove();
    } else if (action === 'refresh') {
      playSound('click');
      refresh();
    }
  });
  document.body.append(modal);
  refresh();
}

function refreshLogDirectory() {
  const target = document.querySelector('#log-path');
  if (!target || !desktopBridge?.getLogDirectory) return;
  desktopBridge.getLogDirectory().then(directory => {
    target.textContent = `Los registros TXT se guardan en: ${directory}`;
  }).catch(() => {});
}

async function refreshRevertSessions() {
  const summary = document.querySelector('#revert-summary');
  const results = document.querySelector('#revert-results');
  if (!summary || !results) return;
  if (!desktopBridge?.getOptimizationSessions) {
    summary.textContent = 'Solo disponible en el portable';
    results.innerHTML = '<div class="card"><strong>Reversión no disponible</strong><small>Abre la aplicación portable para consultar los backups.</small></div>';
    return;
  }
  try {
    const sessions = await desktopBridge.getOptimizationSessions();
    const entries = (Array.isArray(sessions) ? sessions : []).flatMap(session => (session.entries || []).map(entry => ({ session, entry })));
    summary.textContent = `${entries.filter(item => item.entry.status === 'ok').length} ajustes aplicados · ${sessions.length} sesiones`;
    results.innerHTML = entries.length
      ? entries.map(({ session, entry }) => {
        const status = entry.status === 'ok' ? 'Aplicado' : entry.status === 'reverted' ? 'Revertido' : entry.status === 'error' ? 'Error' : 'No aplicado';
        const canRevert = entry.status === 'ok' && entry.reversible;
        const detail = `${formatLogTime(session.createdAt)} · ${entry.reversible ? 'Backup disponible' : 'Sin reversión automática'}${entry.error ? ` · ${entry.error}` : ''}`;
        const dotClass = entry.status === 'error' ? 'warn' : entry.status === 'reverted' ? 'off' : '';
        const buttonText = entry.status === 'reverted' ? 'Revertido' : canRevert ? 'Revertir' : 'No disponible';
        return `<div class="list-item"><i class="status-dot ${dotClass}"></i><div class="grow"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(detail)}</small></div><span class="tag">${status}</span><button class="secondary" data-action="revert-optimization" data-session-id="${escapeHtml(session.sessionId)}" data-optimization-key="${escapeHtml(entry.key)}" ${canRevert ? '' : 'disabled'}>${buttonText}</button></div>`;
      }).join('')
      : '<div class="card"><strong>No hay sesiones</strong><small>Los ajustes aplicados aparecerán aquí con su backup y estado.</small></div>';
  } catch {
    summary.textContent = 'No disponible';
    results.innerHTML = '<div class="card"><strong>No se pudieron leer las sesiones</strong><small>Revisa la carpeta de backups en Documentos.</small></div>';
  }
}

function isOptimizationSelected(key) {
  return state.optimizations[key] === true;
}

function showOptimizationMenu(groupName = null) {
  document.querySelector('.optimization-modal')?.remove();
  const groups = groupName ? optimizationCatalog.filter(group => group.name === groupName) : optimizationCatalog;
  if (!groups.length) return;
  const totalOptions = groups.reduce((total, group) => total + group.options.length, 0);
  const modal = document.createElement('div');
  modal.className = 'optimization-modal';
  modal.innerHTML = `<div class="optimization-backdrop" data-action="close-optimization"></div><div class="optimization-dialog" role="dialog" aria-modal="true" aria-labelledby="optimization-title"><div class="optimization-dialog-header"><div><p class="eyebrow">SUPER OPTIMIZADOR</p><h2 id="optimization-title">${groupName ? `Ajustes de ${escapeHtml(groupName)}` : 'Ajustes de optimización'}</h2><p>Marca solo los ajustes que quieres aplicar. Cada opción ejecuta su cambio de PowerShell o Registro y queda registrada.</p></div><button class="icon-button" data-action="close-optimization" aria-label="Cerrar">×</button></div><div class="optimization-groups">${groups.map(group => `<section class="optimization-group"><div class="optimization-group-header"><div><h3>${escapeHtml(group.name)}</h3><small>${escapeHtml(group.description)} · ${group.options.length} opciones</small></div><button class="secondary" data-action="toggle-group" data-group-name="${escapeHtml(group.name)}">Activar todos</button></div><div class="optimization-options">${group.options.map(([key, label, description]) => `<label class="optimization-option"><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-optimization-key="${escapeHtml(key)}" ${isOptimizationSelected(key) ? 'checked' : ''}><i class="option-switch"></i></label>`).join('')}</div></section>`).join('')}</div><div class="optimization-dialog-footer"><span id="optimization-selection-count">${groups.flatMap(group => group.options).filter(([key]) => isOptimizationSelected(key)).length} seleccionados de ${totalOptions}</span><div><button class="secondary" data-action="close-optimization">Cancelar</button><button class="primary" data-action="apply-optimization">Aplicar selección</button></div></div></div>`;
  document.body.append(modal);
}

function updateOptimizationSelectionCount() {
  const element = document.querySelector('#optimization-selection-count');
  if (!element) return;
  const selected = document.querySelectorAll('[data-optimization-key]:checked').length;
  element.textContent = `${selected} seleccionados de ${optimizationCount}`;
}

function refreshWindowsVersion() {
  const badge = document.querySelector('#windows-version');
  if (!badge) return;
  if (!desktopBridge?.getWindowsInfo) {
    badge.textContent = 'Windows';
    return;
  }
  desktopBridge.getWindowsInfo().then(info => {
    badge.textContent = info?.displayName || 'Windows';
  }).catch(() => { badge.textContent = 'Windows'; });
}

function renderPage(key) {
  const config = pages[key] || pages.optimize;
  title.textContent = config.title;
  page.innerHTML = config.render();
  updateScrollDownButton();
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === key));
  if (key === 'optimize') refreshSystemMetrics();
  if (key === 'health') refreshHealth();
  if (key === 'startup') refreshStartup();
  if (key === 'log') refreshLogDirectory();
  if (key === 'drivers') refreshDrivers();
  if (key === 'games') refreshGames();
  if (key === 'boost') refreshMemoryCleaner();
  if (key === 'revert') refreshRevertSessions();
}

async function refreshSystemMetrics() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const metrics = await desktopBridge.getMetrics();
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element && value) element.textContent = value;
    };
    setText('#system-cpu', metrics.cpu);
    setText('#system-cpu-detail', 'Lectura actual');
    setText('#system-ram', metrics.ramUsed);
    setText('#system-ram-detail', `de ${metrics.ramTotal} usados`);
    const cpuBar = document.querySelector('#system-cpu-bar');
    const ramBar = document.querySelector('#system-ram-bar');
    if (cpuBar && metrics.cpu !== '—') cpuBar.style.width = metrics.cpu;
    if (ramBar && metrics.ramUsed !== '—') ramBar.style.width = `${Math.min(100, Number.parseFloat(metrics.ramUsed) / Number.parseFloat(metrics.ramTotal) * 100)}%`;
  } catch {
    showToast('No se pudieron leer las métricas del sistema.');
  }
}

async function refreshMemoryCleaner() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const health = await desktopBridge.getHealth();
    const percent = Number.isFinite(health.memoryUsedPercent) ? health.memoryUsedPercent : null;
    const label = document.querySelector('#memory-cleaner-percent');
    const gauge = document.querySelector('#memory-cleaner-gauge');
    if (label) label.textContent = percent === null ? '—' : `${percent}%`;
    if (gauge && percent !== null) gauge.style.setProperty('--gauge-percent', `${percent}%`);
  } catch {
    showToast('No se pudo leer el porcentaje de RAM.');
  }
}

async function refreshHealth() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const health = await desktopBridge.getHealth();
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element && value !== undefined && value !== null) element.textContent = value;
    };
    const uptimeHours = health.uptime ? Math.floor(health.uptime / 3600) : 0;
    setText('#health-summary', 'Lectura completada');
    setText('#health-memory', `${health.memoryUsedPercent}%`);
    setText('#health-storage', health.storage ? `${health.storage.usedPercent}%` : '—');
    setText('#health-storage-detail', health.storage ? `${health.storage.freeGb} GB libres en ${health.storage.mount}` : 'Unidad no disponible');
    setText('#health-uptime', `${uptimeHours} h`);
    setText('#health-os', health.os);
  } catch {
    const summary = document.querySelector('#health-summary');
    if (summary) summary.textContent = 'No disponible';
    showToast('No se pudo leer el estado del equipo.');
  }
}

async function refreshStartup() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const entries = await desktopBridge.getStartupEntries();
    const summary = document.querySelector('#startup-summary');
    const results = document.querySelector('#startup-results');
    if (!summary || !results) return;
    summary.textContent = `${entries.length} registros detectados`;
    results.innerHTML = entries.length
      ? entries.map(entry => `<div class="list-item"><i class="status-dot warn"></i><div class="grow"><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.source)} · ${escapeHtml(entry.command)}</small></div><span class="tag">Detectada</span></div>`).join('')
      : '<div class="card"><strong>No se detectaron aplicaciones</strong><small>No hay entradas Run disponibles para mostrar.</small></div>';
  } catch {
    const summary = document.querySelector('#startup-summary');
    if (summary) summary.textContent = 'No disponible';
    showToast('No se pudo leer el registro de inicio.');
  }
}

async function refreshDrivers() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const devices = await desktopBridge.getDrivers();
    const summary = document.querySelector('#drivers-summary');
    const results = document.querySelector('#drivers-results');
    if (!summary || !results) return;
    summary.textContent = `${devices.length} dispositivos detectados`;
    results.innerHTML = devices.length
      ? devices.map(device => `<div class="list-item"><i class="status-dot"></i><div class="grow"><strong>${escapeHtml(device.model)}</strong><small>${escapeHtml(device.category)} · ${escapeHtml(device.vendor)}${device.details ? ` · ${escapeHtml(device.details)}` : ''}</small></div><button class="secondary" data-action="open-driver" data-url="${escapeHtml(device.downloadUrl || 'https://www.catalog.update.microsoft.com/Home.aspx')}">Descargar driver</button><span class="tag">Detectado</span></div>`).join('')
      : '<div class="card"><strong>No se detectaron dispositivos</strong><small>Windows no devolvió información del hardware.</small></div>';
  } catch {
    const summary = document.querySelector('#drivers-summary');
    if (summary) summary.textContent = 'No disponible';
    showToast('No se pudieron leer los dispositivos del equipo.');
  }
}

async function refreshGames() {
  if (!desktopBridge?.isDesktop) return;
  try {
    const games = await desktopBridge.getRunningGames();
    const summary = document.querySelector('#games-summary');
    const results = document.querySelector('#games-results');
    if (!summary || !results) return;
    const activeNames = new Set(games.map(game => game.name));
    summary.textContent = games.length ? `${games.length} juegos activos · perfiles listos` : 'Ningún juego activo · perfiles listos';
    results.querySelectorAll('[data-game-status]').forEach(status => {
      const profile = gameProfiles.find(item => item.id === status.dataset.gameStatus);
      const active = profile && activeNames.has(profile.name);
      status.textContent = active ? 'Activo' : 'Perfil';
      status.classList.toggle('active-tag', Boolean(active));
    });
  } catch {
    const summary = document.querySelector('#games-summary');
    if (summary) summary.textContent = 'No disponible';
    showToast('No se pudieron leer los procesos de juegos.');
  }
}

function showGameProfile(profileId) {
  const profile = gameProfiles.find(item => item.id === profileId);
  if (!profile) return;
  document.querySelector('.game-profile-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'game-profile-modal';
  modal.innerHTML = `<div class="optimization-backdrop" data-action="close-game-profile"></div><div class="optimization-dialog game-dialog" role="dialog" aria-modal="true" aria-labelledby="game-profile-title"><div class="optimization-dialog-header"><div><p class="eyebrow">PERFIL DE JUEGO</p><h2 id="game-profile-title">${escapeHtml(profile.name)}</h2><p>Configuración recomendada para revisar antes de jugar.</p></div><button class="icon-button" data-action="close-game-profile" aria-label="Cerrar">×</button></div><div class="game-profile-detail"><div class="card"><div class="card-header"><span>Ubicación habitual</span><span class="tag">Referencia</span></div><strong>${escapeHtml(profile.path)}</strong><small>Archivo o perfil: ${escapeHtml(profile.file)}</small></div><div class="card"><div class="card-header"><span>Ajustes recomendados</span><span class="tag">${profile.config.length} puntos</span></div><ul>${profile.config.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="profile-note">Super Optimizador no modifica archivos del juego automáticamente. Usa esta ficha como guía para crear o revisar tu CFG.</div></div><div class="optimization-dialog-footer"><span>Perfil local</span><div><button class="secondary" data-action="close-game-profile">Cerrar</button><button class="primary" data-action="prepare-game-profile" data-game-name="${escapeHtml(profile.name)}">Preparar perfil</button></div></div></div>`;
  document.body.append(modal);
}

async function runAiScan() {
  const summary = document.querySelector('#ai-summary');
  const results = document.querySelector('#ai-results');
  if (!desktopBridge?.isDesktop || !summary || !results) {
    if (summary) summary.textContent = 'Solo disponible en el portable';
    return;
  }
  summary.textContent = 'Analizando equipo…';
  try {
    const report = await desktopBridge.runSystemScan();
    summary.textContent = `${report.findings.length} hallazgos · ${formatLogTime(report.generatedAt)}`;
    results.innerHTML = report.findings.map(finding => `<div class="list-item"><i class="status-dot ${finding.level === 'warn' ? 'warn' : finding.level === 'info' ? 'off' : ''}"></i><div class="grow"><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.detail)}</small></div><span class="tag">${finding.level === 'warn' ? 'Revisar' : finding.level === 'info' ? 'Información' : 'Correcto'}</span></div>`).join('');
    addLog('Diagnóstico inteligente completado', `${report.findings.length} comprobaciones locales`);
  } catch {
    summary.textContent = 'No se pudo completar';
    showToast('No se pudo completar el diagnóstico.');
  }
}

document.addEventListener('click', async event => {
  const optimizationOption = event.target.closest('.optimization-option');
  if (optimizationOption) {
    playSound('toggle');
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'toggle-overlay') {
    playSound('toggle');
    toggleOverlay();
    showToast('Overlay alternado.');
    return;
  }
  if (button.classList.contains('switch')) {
    const isOn = !button.classList.toggle('off');
    button.setAttribute('aria-pressed', String(isOn));
    const setting = button.dataset.setting;
    if (setting?.startsWith('startup:')) {
      const name = setting.slice('startup:'.length);
      state.startup[name] = isOn;
      addLog(`${name}: preferencia de inicio actualizada`, isOn ? 'Marcada para iniciar' : 'Marcada para no iniciar');
    } else if (setting && Object.hasOwn(state.settings, setting)) {
      state.settings[setting] = isOn;
      saveState();
      showToast('Preferencia guardada.');
    }
    playSound('toggle');
    return;
  }
  if (button.matches('.primary, .secondary, .run-button, .icon-button, [data-action]')) playSound('click');

  const navItem = event.target.closest('.nav-item');
  if (navItem) { playSound('section'); renderPage(navItem.dataset.page); return; }
  if (!action) return;
  if (action === 'run-selected' || action === 'run-optimization') {
    showOptimizationMenu();
    return;
  }
  if (action === 'run-section') {
    showOptimizationMenu(button.dataset.groupName);
    return;
  }
  if (action === 'close-optimization') {
    document.querySelector('.optimization-modal')?.remove();
    return;
  }
  if (action === 'close-game-profile') {
    document.querySelector('.game-profile-modal')?.remove();
    return;
  }
  if (action === 'show-game-profile') {
    showGameProfile(button.dataset.profileId);
    return;
  }
  if (action === 'prepare-game-profile') {
    const gameName = button.dataset.gameName || 'juego seleccionado';
    addLog(`Perfil preparado: ${gameName}`, 'Configuración CFG lista para revisar');
    document.querySelector('.game-profile-modal')?.remove();
    showToast(`Perfil de ${gameName} preparado.`);
    return;
  }
  if (action === 'open-driver') {
    if (desktopBridge?.openExternal && button.dataset.url) desktopBridge.openExternal(button.dataset.url).catch(() => showToast('No se pudo abrir la página del fabricante.'));
    return;
  }
  if (action === 'toggle-group') {
    const group = optimizationCatalog.find(item => item.name === button.dataset.groupName);
    if (!group) return;
    const keys = group.options.map(([key]) => key);
    const checkboxes = [...document.querySelectorAll('[data-optimization-key]')].filter(input => keys.includes(input.dataset.optimizationKey));
    const shouldEnable = checkboxes.some(input => !input.checked);
    checkboxes.forEach(input => { input.checked = shouldEnable; });
    button.textContent = shouldEnable ? 'Desactivar todos' : 'Activar todos';
    updateOptimizationSelectionCount();
    playSound('toggle');
    return;
  }
  if (action === 'apply-optimization') {
    const selected = [...document.querySelectorAll('[data-optimization-key]:checked')];
    document.querySelectorAll('[data-optimization-key]').forEach(input => { state.optimizations[input.dataset.optimizationKey] = input.checked; });
    saveState();
    if (!selected.length) {
      showToast('Selecciona al menos un ajuste.');
      return;
    }
    const confirmedKeys = [];
    for (const input of selected) {
      const label = input.closest('.optimization-option')?.querySelector('strong')?.textContent || input.dataset.optimizationKey;
      const confirmed = await showActionConfirmation({
        titleText: `Confirmar: ${label}`,
        message: 'Se aplicará este ajuste de Windows.',
        detail: 'Se guardará un backup antes del cambio. Si necesita permisos, aparecerá la confirmación de administrador de Windows. Los ajustes irreversibles quedarán indicados en el registro.',
        confirmText: 'Aplicar tweak'
      });
      if (confirmed) confirmedKeys.push(input.dataset.optimizationKey);
      else addLog(`Tweak cancelado: ${label}`, 'No se aplicó este ajuste');
    }
    if (!confirmedKeys.length) {
      showToast('No se aplicó ningún ajuste.');
      return;
    }
    const applyButton = button;
    applyButton.disabled = true;
    applyButton.textContent = 'Aplicando…';
    try {
      const result = desktopBridge?.applyOptimizations
        ? await desktopBridge.applyOptimizations({ keys: confirmedKeys, createRestorePoint: state.settings.restorePoint !== false })
        : { success: false, error: 'La ejecución real está disponible en el EXE portable.' };
      if (result.success) {
        addLog('Ajustes aplicados', `${confirmedKeys.length} opciones · Sesión: ${result.sessionId || 'guardada'} · Registro TXT: ${result.logPath || 'guardado'}`);
        document.querySelector('.optimization-modal')?.remove();
        showToast(`Ajustes aplicados. Registro TXT guardado en ${result.logPath || 'la carpeta de documentos'}.`);
      } else {
        if (result.partial) addLog('Aplicación parcial de ajustes', `${result.sessionId || 'Sesión guardada'} · Registro TXT: ${result.logPath || 'guardado'}`);
        showToast(result.error || 'No se pudieron aplicar los ajustes.');
      }
    } catch {
      showToast('No se pudieron aplicar los ajustes.');
    } finally {
      if (applyButton.isConnected) { applyButton.disabled = false; applyButton.textContent = 'Aplicar selección'; }
    }
    return;
  }
  if (action === 'revert-optimization') {
    if (!desktopBridge?.revertOptimization) {
      showToast('La reversión está disponible en el EXE portable.');
      return;
    }
    const confirmed = await showActionConfirmation({
      titleText: 'Revertir ajuste',
      message: 'Se restaurará la copia guardada antes de este tweak.',
      detail: 'La operación puede solicitar permisos de administrador si el cambio original los necesitaba.',
      confirmText: 'Revertir'
    });
    if (!confirmed) return;
    button.disabled = true;
    button.textContent = 'Revirtiendo…';
    try {
      const result = await desktopBridge.revertOptimization({ sessionId: button.dataset.sessionId, key: button.dataset.optimizationKey });
      if (result.success) {
        addLog(`Tweak revertido: ${result.label || button.dataset.optimizationKey}`, `Registro TXT: ${result.logPath || 'guardado'}`);
        showToast(`Ajuste revertido. Registro TXT guardado en ${result.logPath || 'la carpeta de documentos'}.`);
      } else showToast(result.error || 'No se pudo revertir el ajuste.');
      await refreshRevertSessions();
    } catch {
      showToast('No se pudo revertir el ajuste.');
      button.disabled = false;
      button.textContent = 'Revertir';
    }
    return;
  }
  if (action === 'clear-log') {
    state.log = [];
    saveState();
    renderPage('log');
    showToast('Registro limpiado.');
    return;
  }
  if (action === 'ai-scan') {
    runAiScan();
    return;
  }
  if (action === 'detect-games') {
    refreshGames();
    return;
  }
  if (action === 'driver-scan') {
    refreshDrivers();
    showToast('Lectura de dispositivos actualizada.');
    return;
  }
  if (action === 'open-sensors') {
    if (!desktopBridge?.getMetrics) {
      showToast('Los sensores están disponibles en el EXE portable.');
      return;
    }
    playSound('click');
    showHardwareSensors();
    return;
  }
  if (action === 'game-profile') {
    const gameName = button.dataset.gameName || 'juego seleccionado';
    addLog(`Perfil preparado: ${gameName}`, 'Configuración CFG lista para revisar');
    showToast(`Perfil de ${gameName} preparado.`);
    return;
  }
  if (action === 'apply-dns') {
    if (!desktopBridge?.applyDns) {
      showToast('Aplicar DNS está disponible en el EXE portable.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Aplicando…';
    const name = button.dataset.dnsName;
    const servers = [button.dataset.dnsPrimary, button.dataset.dnsSecondary];
    const confirmed = await showActionConfirmation({
      titleText: `Aplicar ${name}`,
      message: `Se cambiará el DNS activo a ${servers.join(' y ')}.`,
      detail: 'Se detectará la conexión Ethernet o Wi‑Fi activa. Después de confirmar aparecerá el UAC real de Windows.',
      confirmText: 'Aplicar DNS'
    });
    if (!confirmed) {
      button.disabled = false;
      button.textContent = 'Aplicar en red activa';
      showToast('Cambio de DNS cancelado.');
      return;
    }
    try {
      const result = await desktopBridge.applyDns({ name, servers });
      if (result.cancelled) {
        showToast('Cambio de DNS cancelado.');
      } else if (result.success) {
        addLog(`DNS aplicado: ${name}`, `${servers.join(' / ')} · Adaptador: ${result.adapters || 'red activa'}`);
        showToast(`${name} aplicado en ${result.adapters || 'la red activa'}.`);
      } else {
        showToast(result.error || 'No se pudo aplicar el DNS.');
      }
    } catch {
      showToast('No se pudo aplicar el DNS.');
    } finally {
      if (button.isConnected) { button.disabled = false; button.textContent = 'Aplicar en red activa'; }
    }
    return;
  }
  if (action === 'clean-memory') {
    if (!desktopBridge?.isDesktop) {
      showToast('El limpiador de RAM está disponible en el EXE portable.');
      return;
    }
    const confirmed = await showActionConfirmation({
      titleText: 'Limpiar memoria RAM',
      message: 'Se ejecutará ReduceMemory para liberar memoria.',
      detail: 'Después de confirmar aparecerá el UAC real de Windows. La herramienta se ejecutará y se cerrará al terminar.',
      confirmText: 'Limpiar RAM'
    });
    if (!confirmed) {
      showToast('Limpieza cancelada.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Limpiando…';
    desktopBridge.cleanMemory().then(async result => {
      if (result.cancelled) {
        showToast('Limpieza cancelada.');
        return;
      }
      if (result.success) {
        addLog('Memoria RAM limpiada', 'ReduceMemory optimizó los working sets de aplicaciones y servicios');
        await refreshMemoryCleaner();
        showToast('RAM optimizada con ReduceMemory.');
      } else {
        showToast(result.error || 'ReduceMemory no pudo completar la limpieza.');
      }
    }).catch(() => showToast('No se pudo ejecutar el limpiador de RAM.')).finally(() => {
      if (button.isConnected) { button.disabled = false; button.textContent = 'Limpiar RAM'; }
    });
    return;
  }
  const messages = {
    'add-game': 'Selector de juegos preparado para la próxima versión.',
    'game-profile': 'Perfil de juego preparado y listo para revisar.',
    'inspect': 'Detalle disponible en el informe de diagnóstico.',
    'clear-log': 'Registro visual limpiado.',
    'revert': 'Asistente de reversión preparado; no hay cambios aplicados.',
    'measure-ping': desktopBridge?.isDesktop ? 'Medición real iniciada.' : 'Medición simulada actualizada.',
    'toggle-overlay': 'Overlay alternado.'
  };
  showToast(messages[action] || 'Acción preparada para implementación.');
});

function toggleOverlay() {
  const overlay = document.querySelector('#performance-overlay');
  overlayEnabled = !overlayEnabled;
  state.settings.overlay = overlayEnabled;
  saveState();
  const isHidden = !overlayEnabled;
  overlay.classList.toggle('hidden', isHidden || desktopBridge?.isDesktop);
  if (desktopBridge?.isDesktop) desktopBridge.setOverlay(overlayEnabled).catch(() => showToast('No se pudo iniciar el overlay.'));
  document.querySelectorAll('[data-action="toggle-overlay"]').forEach(button => {
    button.setAttribute('aria-pressed', String(overlayEnabled));
    if (button.classList.contains('switch')) button.classList.toggle('off', isHidden);
    const label = button.querySelector('[data-overlay-label]');
    const icon = button.querySelector('[data-overlay-icon]');
    if (label) label.textContent = isHidden ? 'Overlay de FPS' : 'Overlay activo';
    if (icon) icon.textContent = isHidden ? '□' : '●';
    button.classList.toggle('active', overlayEnabled);
  });
}

function updatePingCards(values) {
  const best = values.filter(item => Number.isFinite(item.value)).sort((a, b) => a.value - b.value)[0]?.value;
  const cards = [...document.querySelectorAll('.dns-card')];
  cards.forEach((card, index) => {
    const value = values[index].value;
    const reachable = Number.isFinite(value);
    card.querySelector('[data-ping-value]').textContent = reachable ? value : '—';
    card.querySelector('.dns-bar b').style.setProperty('--ping-width', reachable ? `${Math.min(100, value * 2.1)}%` : '0%');
    card.classList.toggle('best', reachable && value === best);
    card.classList.toggle('unreachable', !reachable);
  });
  return best;
}

function measureDemoPing() {
  const values = [
    ['Google DNS', 14 + Math.floor(Math.random() * 23)],
    ['Cloudflare', 10 + Math.floor(Math.random() * 20)],
    ['OpenDNS', 18 + Math.floor(Math.random() * 29)]
  ];
  updatePingCards(values.map(([name, value]) => ({ name, value })));
  const updated = document.querySelector('#ping-updated');
  if (updated) updated.textContent = `Medido ahora · mejor: ${values.sort((a, b) => a[1] - b[1])[0][0]}`;
}

async function measureRealPing() {
  const updated = document.querySelector('#ping-updated');
  if (updated) updated.textContent = 'Midiendo desde este equipo…';
  try {
    const results = await desktopBridge.measurePing();
    const values = results.map(result => ({ name: result.name, value: result.milliseconds }));
    const best = updatePingCards(values);
    const bestName = results.find(result => result.milliseconds === best)?.name;
    if (updated) updated.textContent = bestName ? `Medido ahora · mejor: ${bestName}` : 'Sin respuesta de las DNS';
  } catch {
    if (updated) updated.textContent = 'No se pudo completar la medición';
    showToast('No se pudo medir el ping.');
  }
}

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'measure-ping') {
    if (desktopBridge?.isDesktop) measureRealPing();
    else measureDemoPing();
  }
});

document.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-optimization-key]');
  if (!checkbox) return;
  state.optimizations[checkbox.dataset.optimizationKey] = checkbox.checked;
  saveState();
  updateOptimizationSelectionCount();
});

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('mouseenter', () => playSound('hover')));

const countBadge = document.querySelector('#optimization-count');
if (countBadge) countBadge.textContent = optimizationCount;
refreshWindowsVersion();
document.querySelectorAll('[data-action="toggle-overlay"]').forEach(button => {
  button.setAttribute('aria-pressed', String(overlayEnabled));
  button.classList.toggle('active', overlayEnabled);
  const label = button.querySelector('[data-overlay-label]');
  const icon = button.querySelector('[data-overlay-icon]');
  if (label) label.textContent = overlayEnabled ? 'Overlay activo' : 'Overlay de FPS';
  if (icon) icon.textContent = overlayEnabled ? '●' : '□';
});
renderPage('optimize');
if (overlayEnabled && desktopBridge?.isDesktop) {
  desktopBridge.setOverlay(true).catch(() => {
    overlayEnabled = false;
    state.settings.overlay = false;
    saveState();
  });
}

function updateScrollDownButton() {
  if (!scrollDownButton) return;
  const scrollingElement = document.scrollingElement || document.documentElement;
  const remaining = scrollingElement.scrollHeight - scrollingElement.clientHeight - scrollingElement.scrollTop;
  scrollDownButton.hidden = remaining < 28;
  scrollDownButton.classList.toggle('at-bottom', remaining < 90);
  scrollDownButton.textContent = remaining < 90 ? '↑ Arriba' : '↓ Bajar';
  scrollDownButton.setAttribute('aria-label', remaining < 90 ? 'Subir al inicio' : 'Bajar en la página');
}

scrollDownButton?.addEventListener('click', () => {
  playSound('click');
  const scrollingElement = document.scrollingElement || document.documentElement;
  const remaining = scrollingElement.scrollHeight - scrollingElement.clientHeight - scrollingElement.scrollTop;
  scrollingElement.scrollBy({ top: remaining < 90 ? -scrollingElement.scrollTop : Math.max(240, scrollingElement.clientHeight * 0.78), behavior: 'smooth' });
});
window.addEventListener('scroll', updateScrollDownButton, { passive: true });
window.addEventListener('resize', updateScrollDownButton);
updateScrollDownButton();
