const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');

const execFileAsync = promisify(execFile);

let mainWindow;
let overlayWindow;
let overlayEnabled = false;
let metricsTimer;
let metricsInFlight = false;
let presentMonProcess;
let presentMonLineBuffer = '';
let presentMonHeader;
let presentMonApplicationIndex = -1;
let presentMonFrameTimeIndex = -1;
let presentMonError = '';
let fpsSessionActive = false;
const frameSamples = new Map();
const presentMonSession = 'SuperOptimizadorFPS';

let systemInformation;
try {
  systemInformation = require('systeminformation');
} catch {
  systemInformation = null;
}

const dnsTargets = [
  { name: 'Google DNS', address: '8.8.8.8' },
  { name: 'Cloudflare', address: '1.1.1.1' },
  { name: 'OpenDNS', address: '208.67.222.222' }
];

const ignoredFrameProcesses = new Set([
  'dwm',
  'explorer',
  'super-optimizador-portable-0.1.0',
  'super optimizador',
  'presentmon-2.5.1-x64',
  'shellexperiencehost',
  'startmenuexperiencehost',
  'runtimebroker',
  'sihost',
  'searchhost',
  'applicationframehost',
  'textinputhost',
  'lockapp',
  'searchapp'
]);

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#001736',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a3a5c',
      symbolColor: '#d8ecff',
      height: 31
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.on('closed', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
    overlayWindow = null;
    mainWindow = null;
  });
}

function positionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const [width, height] = overlayWindow.getSize();
  overlayWindow.setPosition(area.x + area.width - width - 18, area.y + 18, false);
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive();
    positionOverlay();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 252,
    height: 134,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    movable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.once('ready-to-show', () => {
    positionOverlay();
    overlayWindow.showInactive();
    sendMetrics();
  });
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

function closeOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  overlayWindow = null;
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else field += character;
  }
  fields.push(field);
  return fields;
}

function presentMonProcessKey(value) {
  return String(value || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .split(/[\\/]/)
    .pop()
    .replace(/\.exe$/i, '')
    .trim()
    .toLowerCase();
}

function recordPresentMonOutput(chunk) {
  presentMonLineBuffer += chunk;
  const lines = presentMonLineBuffer.split(/\r?\n/);
  presentMonLineBuffer = lines.pop() || '';
  for (const line of lines) {
    const cleanLine = line.replace(/^\uFEFF/, '');
    if (!cleanLine.trim()) continue;
    const fields = parseCsvLine(cleanLine).map(value => value.trim());
    if (!presentMonHeader) {
      const normalizedFields = fields.map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const applicationIndex = normalizedFields.indexOf('application');
      const frameTimeIndex = normalizedFields.indexOf('msbetweenpresents') >= 0
        ? normalizedFields.indexOf('msbetweenpresents')
        : normalizedFields.indexOf('displayedtime');
      if (applicationIndex >= 0 && frameTimeIndex >= 0) {
        presentMonApplicationIndex = applicationIndex;
        presentMonFrameTimeIndex = frameTimeIndex;
        presentMonHeader = fields;
      }
      continue;
    }
    if (presentMonApplicationIndex < 0 || presentMonFrameTimeIndex < 0) continue;
    const processName = presentMonProcessKey(fields[presentMonApplicationIndex]);
    if (!processName || ignoredFrameProcesses.has(processName)) continue;
    const milliseconds = Number.parseFloat(fields[presentMonFrameTimeIndex]);
    if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 2000) continue;
    const samples = frameSamples.get(processName) || [];
    samples.push({ ms: milliseconds, t: Date.now() });
    frameSamples.set(processName, samples);
  }
}

function presentMonExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'PresentMon-2.5.1-x64.exe')
    : path.join(__dirname, '..', 'tools', 'PresentMon-2.5.1-x64.exe');
}

function hardwareSensorExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'hardware-sensors', 'HardwareSensors.exe')
    : path.join(__dirname, '..', 'tools', 'hardware-sensors', 'HardwareSensors.exe');
}

function startFpsMonitor() {
  if (presentMonProcess) return;
  const executable = presentMonExecutable();
  presentMonHeader = null;
  presentMonApplicationIndex = -1;
  presentMonFrameTimeIndex = -1;
  presentMonLineBuffer = '';
  presentMonError = '';
  frameSamples.clear();
  presentMonProcess = spawn(executable, [
    '--output_stdout',
    '--no_track_display',
    '--no_track_gpu',
    '--no_console_stats',
    '--v1_metrics',
    '--exclude_dropped',
    '--set_circular_buffer_size',
    '256',
    '--stop_existing_session',
    '--session_name',
    presentMonSession
  ], { windowsHide: true });
  fpsSessionActive = true;
  presentMonProcess.stdout.setEncoding('utf8');
  presentMonProcess.stdout.on('data', recordPresentMonOutput);
  presentMonProcess.stderr.setEncoding('utf8');
  presentMonProcess.stderr.on('data', chunk => {
    if (/error|failed|requires elevated/i.test(chunk)) presentMonError = chunk.trim();
  });
  presentMonProcess.on('error', error => { presentMonError = error.message; presentMonProcess = null; });
  presentMonProcess.on('close', () => { presentMonProcess = null; });
}

function stopFpsMonitor() {
  if (!presentMonProcess && !fpsSessionActive) return;
  if (presentMonProcess && !presentMonProcess.killed) presentMonProcess.kill();
  const executable = presentMonExecutable();
  const cleanup = spawn(executable, [
    '--session_name',
    presentMonSession,
    '--terminate_existing_session'
  ], { windowsHide: true, stdio: 'ignore' });
  cleanup.unref();
  presentMonProcess = null;
  fpsSessionActive = false;
  presentMonHeader = null;
  presentMonApplicationIndex = -1;
  presentMonFrameTimeIndex = -1;
  presentMonLineBuffer = '';
  frameSamples.clear();
}

function currentFps() {
  const cutoff = Date.now() - 2000;
  let selected;
  for (const [processName, samples] of frameSamples) {
    const recent = samples.filter(sample => sample.t >= cutoff);
    frameSamples.set(processName, recent);
    if (recent.length && (!selected || recent.length > selected.length)) selected = recent;
  }
  if (!selected || selected.length < 5) return '—';
  const averageMs = selected.reduce((sum, sample) => sum + sample.ms, 0) / selected.length;
  if (!Number.isFinite(averageMs) || averageMs <= 0) return '—';
  return `${Math.round(1000 / averageMs)}`;
}

async function readUniversalHardwareSensors() {
  const executable = hardwareSensorExecutable();
  try {
    const { stdout } = await execFileAsync(executable, [], {
      windowsHide: true,
      timeout: 7000,
      maxBuffer: 32 * 1024
    });
    const line = stdout.trim().split(/\r?\n/).pop();
    if (!line) return null;
    const parsed = JSON.parse(line);
    const numberOrNull = value => {
      if (value === null || value === undefined || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    return {
      cpuTemp: numberOrNull(parsed.cpuTemp),
      gpuTemp: numberOrNull(parsed.gpuTemp),
      gpuUsage: numberOrNull(parsed.gpuUsage)
    };
  } catch {
    return null;
  }
}

async function readWindowsGpuTelemetry() {
  const script = [
    "$source = [string]::Join([Environment]::NewLine, @(",
    "'using System;',",
    "'using System.Runtime.InteropServices;',",
    "'public static class AmdAdlTelemetry {',",
    "'  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] public delegate IntPtr Alloc(int size);',",
    "'  [DllImport(\"atiadlxx.dll\", CallingConvention=CallingConvention.Cdecl)] static extern int ADL2_Main_Control_Create(Alloc callback, int adapters, ref IntPtr context);',",
    "'  [DllImport(\"atiadlxx.dll\", CallingConvention=CallingConvention.Cdecl)] static extern int ADL2_Main_Control_Destroy(IntPtr context);',",
    "'  [DllImport(\"atiadlxx.dll\", CallingConvention=CallingConvention.Cdecl)] static extern int ADL2_OverdriveN_PerformanceStatus_Get(IntPtr context, int adapter, out Status status);',",
    "'  [StructLayout(LayoutKind.Sequential)] public struct Status { public int core; public int mem; public int dcef; public int gfx; public int uvd; public int vce; public int activity; public int coreLevel; public int memLevel; public int dcefLevel; public int gfxLevel; public int uvdLevel; public int vceLevel; public int bus; public int lanes; public int maxLanes; public int vddc; public int vddci; }',",
    "'  public static int Read() { Alloc callback = Marshal.AllocHGlobal; IntPtr context=IntPtr.Zero; if (ADL2_Main_Control_Create(callback, 1, ref context) != 0) return -1; Status status; int performanceResult=ADL2_OverdriveN_PerformanceStatus_Get(context, 0, out status); if (context != IntPtr.Zero) ADL2_Main_Control_Destroy(context); return performanceResult == 0 ? status.activity : -1; }',",
    "'}'",
    ")); Add-Type -TypeDefinition $source",
    "$amd = -1; try { $amd = [AmdAdlTelemetry]::Read() } catch {}",
    "$engines = @(Get-CimInstance -ClassName 'Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine' -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '_phys_\\d+_eng_' })",
    "$active = @($engines | ForEach-Object { [double]$_.UtilizationPercentage } | Where-Object { $_ -ge 0 -and $_ -le 100 })",
    "$engineUsage = if ($active.Count -gt 0) { [math]::Round((($active | Measure-Object -Maximum).Maximum), 0) } else { -1 }",
    "$usage = if ($amd -ge 0 -and $amd -le 100) { $amd } else { $engineUsage }",
    "[pscustomobject]@{ usage = $usage } | ConvertTo-Json -Compress"
  ].join('; ');
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
    ], { windowsHide: true, timeout: 4000, maxBuffer: 32 * 1024 });
    const parsed = JSON.parse(stdout.trim());
    const usage = Number(parsed.usage);
    return { usage: Number.isFinite(usage) && usage >= 0 && usage <= 100 ? Math.round(usage) : null };
  } catch {
    return null;
  }
}

async function readMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const metrics = {
    fps: currentFps(),
    gpu: '—',
    ram: `${(freeMemory / (1024 ** 3)).toFixed(1)} GB`,
    ramUsed: `${((totalMemory - freeMemory) / (1024 ** 3)).toFixed(1)} GB`,
    ramTotal: `${(totalMemory / (1024 ** 3)).toFixed(1)} GB`,
    cpu: '—',
    temperature: '—',
    temperatureSource: '',
    gpuTemperature: '—'
  };

  if (systemInformation) {
    try {
      const [graphics, temperature, load] = await Promise.all([
        systemInformation.graphics(),
        systemInformation.cpuTemperature(),
        systemInformation.currentLoad()
      ]);
      const controller = graphics.controllers?.find(item => Number.isFinite(item.utilizationGpu));
      if (controller) metrics.gpu = `${Math.round(controller.utilizationGpu)}%`;
      const gpuController = graphics.controllers?.find(item => !/parsec|virtual/i.test(`${item.model} ${item.vendor}`)) || graphics.controllers?.[0];
      const gpuDegrees = Number(gpuController?.temperatureGpu ?? gpuController?.temperature ?? gpuController?.temperatureCore);
      if (Number.isFinite(gpuDegrees) && gpuDegrees > 0) metrics.gpuTemperature = `${Math.round(gpuDegrees)}°C`;
      if (Number.isFinite(load.currentLoad)) metrics.cpu = `${Math.round(load.currentLoad)}%`;
      const cpuDegrees = Number(temperature.main ?? temperature.max);
      if (Number.isFinite(cpuDegrees) && cpuDegrees > 0) {
        metrics.temperature = `${Math.round(cpuDegrees)}°C`;
        metrics.temperatureSource = 'systeminformation';
      }
    } catch {
      // Some Windows telemetry providers are unavailable; use the native fallback below.
    }
  }

  const universalSensors = await readUniversalHardwareSensors();
  if (universalSensors?.gpuUsage !== null && universalSensors?.gpuUsage !== undefined) {
    metrics.gpu = `${Math.round(universalSensors.gpuUsage)}%`;
  }
  if (universalSensors?.gpuTemp !== null && universalSensors?.gpuTemp !== undefined) {
    metrics.gpuTemperature = `${Math.round(universalSensors.gpuTemp)}°C`;
  }
  if (universalSensors?.cpuTemp !== null && universalSensors?.cpuTemp !== undefined) {
    metrics.temperature = `${Math.round(universalSensors.cpuTemp)}°C`;
    metrics.temperatureSource = 'LibreHardwareMonitor';
  }

  const gpuTelemetry = metrics.gpu === '—'
    ? await readWindowsGpuTelemetry()
    : null;
  if (gpuTelemetry?.usage !== null && gpuTelemetry?.usage !== undefined) metrics.gpu = `${gpuTelemetry.usage}%`;
  return metrics;
}

async function sendMetrics() {
  if (!overlayEnabled || !overlayWindow || overlayWindow.isDestroyed()) return;
  if (metricsInFlight) return;
  metricsInFlight = true;
  readMetrics().then(metrics => {
    if (overlayEnabled && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('metrics:update', metrics);
    }
  }).catch(() => {}).finally(() => { metricsInFlight = false; });
}

async function measureHost(address) {
  try {
    const { stdout } = await execFileAsync('ping.exe', ['-n', '1', '-w', '1500', address], {
      windowsHide: true,
      timeout: 2500,
      maxBuffer: 32 * 1024
    });
    const match = stdout.match(/[=<]\s*(\d+)\s*ms/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function measureDnsTargets() {
  return Promise.all(dnsTargets.map(async target => ({
    ...target,
    milliseconds: await measureHost(target.address)
  })));
}

function parseStartupOutput(stdout, source) {
  return stdout.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s{4}(.+?)\s+REG_\w+\s+(.*)$/);
    if (!match) return [];
    return [{ name: match[1].trim(), command: match[2].trim(), source }];
  });
}

async function readStartupEntries() {
  const locations = [
    ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'Usuario actual'],
    ['HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'Todos los usuarios']
  ];
  const entries = [];
  for (const [key, source] of locations) {
    try {
      const { stdout } = await execFileAsync('reg.exe', ['query', key], {
        windowsHide: true,
        timeout: 3000,
        maxBuffer: 256 * 1024
      });
      entries.push(...parseStartupOutput(stdout, source));
    } catch {
      // A missing registry key is normal on some Windows installations.
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function readHealth() {
  const fallback = {
    uptime: Math.round(os.uptime()),
    memoryUsedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    storage: null,
    os: `${os.platform()} ${os.release()}`
  };
  if (!systemInformation) return fallback;
  try {
    const [osInfo, fsSize] = await Promise.all([
      systemInformation.osInfo(),
      systemInformation.fsSize()
    ]);
    const systemDrive = fsSize.find(item => item.mount?.toUpperCase() === 'C:') || fsSize[0];
    return {
      ...fallback,
      os: [osInfo.distro, osInfo.release].filter(Boolean).join(' ') || fallback.os,
      storage: systemDrive ? {
        usedPercent: Math.round(systemDrive.use),
        freeGb: Number((systemDrive.available / (1024 ** 3)).toFixed(1)),
        mount: systemDrive.mount
      } : null
    };
  } catch {
    return fallback;
  }
}

async function readWindowsInfo() {
  const fallback = { displayName: `Windows ${os.release()}` };
  try {
    const key = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion';
    const { stdout } = await execFileAsync('reg.exe', ['query', key], {
      windowsHide: true,
      timeout: 3000,
      maxBuffer: 64 * 1024
    });
    const values = {};
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s{4}(ProductName|DisplayVersion|ReleaseId|CurrentBuild)\s+REG_\w+\s+(.+)$/i);
      if (match) values[match[1].toLowerCase()] = match[2].trim();
    }
    const product = values.productname || fallback.displayName;
    const version = values.displayversion || values.releaseid;
    return { displayName: [product, version].filter(Boolean).join(' ') };
  } catch {
    return fallback;
  }
}

async function readGraphicsDevices() {
  if (!systemInformation) return [];
  try {
    const graphics = await systemInformation.graphics();
    return (graphics.controllers || []).map(controller => ({
      model: controller.model || 'GPU no identificada',
      vendor: controller.vendor || 'Fabricante desconocido',
      vram: Number.isFinite(controller.vram) && controller.vram > 0 ? `${controller.vram} MB` : 'Compartida o no disponible',
      utilization: Number.isFinite(controller.utilizationGpu) ? `${Math.round(controller.utilizationGpu)}%` : '—'
    }));
  } catch {
    return [];
  }
}

function driverDownloadUrl(category, vendor, model) {
  const value = `${category} ${vendor} ${model}`.toLowerCase();
  if (value.includes('nvidia')) return 'https://www.nvidia.com/Download/index.aspx';
  if (value.includes('amd') || value.includes('radeon')) return 'https://www.amd.com/en/support/download/drivers.html';
  if (value.includes('intel')) return 'https://www.intel.com/content/www/us/en/download-center/home.html';
  if (value.includes('realtek')) return 'https://www.realtek.com/Download/Index?cate_id=194';
  if (value.includes('asus') || category.toLowerCase() === 'placa base') return 'https://www.asus.com/support/Download-Center/';
  return 'https://www.catalog.update.microsoft.com/Home.aspx';
}

const optimizationOperations = {
  powerPlan: { label: 'Plan de energía de alto rendimiento', command: 'powercfg.exe /setactive SCHEME_MIN' },
  gameBar: { label: 'Deshabilitar Xbox Game Bar', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR' 'AppCaptureEnabled' 0; Set-RegDword 'HKCU:\\System\\GameConfigStore' 'GameDVR_Enabled' 0" },
  gameMode: { label: 'Activar Modo Juego de Windows', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\GameBar' 'AutoGameModeEnabled' 1" },
  networkThrottle: { label: 'Corrección NetworkThrottlingIndex', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex' 4294967295" },
  disableMpo: { label: 'Deshabilitar Multiplane Overlay (MPO)', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' 'OverlayTestMode' 5" },
  hags: { label: 'Deshabilitar HAGS', command: "Set-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode' 1" },
  powerThrottling: { label: 'Deshabilitar limitación de energía', command: "Set-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' 'PowerThrottlingOff' 1" },
  usbSuspend: { label: 'Desactivar suspensión selectiva USB', command: 'powercfg.exe /SETACVALUEINDEX SCHEME_CURRENT SUB_USB USBSELECTIVE SUSPEND 0; powercfg.exe /SETACTIVE SCHEME_CURRENT' },
  sysMain: { label: 'SysMain (Superfetch)', command: "Set-ServiceSafe 'SysMain' 'Disabled'" },
  searchIndex: { label: 'Windows Search Indexing', command: "Set-ServiceSafe 'WSearch' 'Manual'" },
  telemetry: { label: 'Telemetry (DiagTrack)', command: "Set-ServiceSafe 'DiagTrack' 'Disabled'" },
  diagnostics: { label: 'Diagnostic Policy Service', command: "Set-ServiceSafe 'DPS' 'Manual'" },
  printSpooler: { label: 'Print Spooler', command: "Set-ServiceSafe 'Spooler' 'Manual'" },
  disableWer: { label: 'Windows Error Reporting', command: "Set-ServiceSafe 'WerSvc' 'Manual'" },
  backgroundApps: { label: 'Reducir aplicaciones en segundo plano', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' 'GlobalUserDisabled' 1" },
  tempClean: { label: 'Limpiar archivos temporales', command: "$targets = @($env:TEMP, (Join-Path $env:WINDIR 'Temp')); foreach ($target in $targets) { if (Test-Path $target) { Get-ChildItem -LiteralPath $target -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue } }" },
  prefetch: { label: 'Limpiar Temp y Prefetch', command: "if (Test-Path (Join-Path $env:WINDIR 'Prefetch')) { Get-ChildItem -LiteralPath (Join-Path $env:WINDIR 'Prefetch') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }" },
  flushDns: { label: 'Vaciar caché DNS', command: 'ipconfig.exe /flushdns' },
  winsockReset: { label: 'Restablecer Winsock', command: 'netsh.exe winsock reset' },
  ipReset: { label: 'Restablecer pila IP', command: 'netsh.exe int ip reset' },
  deliveryOptimization: { label: 'Deshabilitar Delivery Optimization', command: "Set-ServiceSafe 'DoSvc' 'Manual'; Set-RegDword 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config' 'DODownloadMode' 100" },
  disableHibernate: { label: 'Deshabilitar hibernación', command: 'powercfg.exe /hibernate off' },
  systemResponsiveness: { label: 'Optimizar SystemResponsiveness', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness' 0" },
  coreParking: { label: 'Desactivar core parking', command: 'powercfg.exe /SETACVALUEINDEX SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100; powercfg.exe /SETACTIVE SCHEME_CURRENT' },
  dynamicTick: { label: 'Desactivar dynamic tick', command: 'bcdedit.exe /set disabledynamictick yes' },
  fullscreenOpt: { label: 'Deshabilitar optimizaciones de pantalla completa', command: "Set-RegDword 'HKCU:\\System\\GameConfigStore' 'GameDVR_FSEBehaviorMode' 2; Set-RegDword 'HKCU:\\System\\GameConfigStore' 'GameDVR_HonorUserFSEBehaviorMode' 1" },
  gpuMsi: { label: 'Activar GPU MSI mode', command: "Get-PnpDevice -Class Display -Status OK -ErrorAction SilentlyContinue | ForEach-Object { $path = \"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"; Set-RegDword $path 'MSISupported' 1 }" },
  pciAspm: { label: 'Deshabilitar PCIe ASPM', command: 'powercfg.exe /SETACVALUEINDEX SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0; powercfg.exe /SETACTIVE SCHEME_CURRENT' },
  hpet: { label: 'Deshabilitar HPET', command: 'bcdedit.exe /deletevalue useplatformclock' },
  timerResolution: { label: 'Resolución del temporizador (1 ms)', command: "Set-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' 'GlobalTimerResolutionRequests' 1" },
  gamePriority: { label: 'Vigilancia de prioridad del juego', command: "Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'java|peak|cs2|roblox|genshin|zenless' } | ForEach-Object { try { $_.PriorityClass = 'High' } catch {} }" },
  copilot: { label: 'Deshabilitar Windows Copilot', command: "Set-RegDword 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' 'TurnOffWindowsCopilot' 1" },
  advertisingId: { label: 'Deshabilitar Advertising ID', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' 'Enabled' 0" },
  activityHistory: { label: 'Deshabilitar Activity History', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' 'PublishUserActivities' 0; Set-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' 'UploadUserActivities' 0" },
  tailoredExp: { label: 'Deshabilitar Tailored Experiences', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy' 'TailoredExperiencesWithDiagnosticDataEnabled' 0" },
  diagnosticData: { label: 'Usar datos de diagnóstico mínimos', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' 'AllowTelemetry' 1" },
  visualEffects: { label: 'Optimizar efectos visuales', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' 'VisualFXSetting' 3" },
  widgets: { label: 'Deshabilitar Widgets', command: "Set-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh' 'AllowNewsAndInterests' 0" },
  classicContextMenu: { label: 'Restaurar menú contextual clásico', command: "New-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Name '(Default)' -Value ''" },
  transparency: { label: 'Deshabilitar efectos de transparencia', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' 'EnableTransparency' 0" },
  notifications: { label: 'Reducir notificaciones', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' 'ToastEnabled' 0" },
  focusAssist: { label: 'Activar Asistencia de concentración', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\QuietHours' 'QuietHoursState' 1" },
  oneDriveDisable: { label: 'Deshabilitar inicio de OneDrive', command: "Remove-RegValue 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'OneDrive'" },
  startupCleanup: { label: 'Limpiar accesos de inicio', command: "$startup = [Environment]::GetFolderPath('Startup'); if (Test-Path $startup) { Get-ChildItem -LiteralPath $startup -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue }" },
  mouseAccel: { label: 'Deshabilitar aceleración del ratón', command: "Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseSpeed' '0'; Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseThreshold1' '0'; Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseThreshold2' '0'" },
  mouseSpeed: { label: 'Ajustar velocidad del ratón', command: "Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseSensitivity' '10'" },
  pointerPrecision: { label: 'Deshabilitar precisión mejorada', command: "Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseSpeed' '0'; Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseThreshold1' '0'; Set-RegString 'HKCU:\\Control Panel\\Mouse' 'MouseThreshold2' '0'" },
  keyboardRepeat: { label: 'Acelerar repetición del teclado', command: "Set-RegString 'HKCU:\\Control Panel\\Keyboard' 'KeyboardDelay' '0'; Set-RegString 'HKCU:\\Control Panel\\Keyboard' 'KeyboardSpeed' '31'" },
  filterKeys: { label: 'Deshabilitar Filter Keys', command: "Set-RegDword 'HKCU:\\Control Panel\\Accessibility\\Keyboard Response' 'Flags' 122" },
  stickyKeys: { label: 'Deshabilitar Sticky Keys', command: "Set-RegDword 'HKCU:\\Control Panel\\Accessibility\\StickyKeys' 'Flags' 506" },
  oneDriveRemove: { label: 'Eliminar OneDrive', command: "$setup = @($env:SystemRoot + '\\SysWOW64\\OneDriveSetup.exe', $env:SystemRoot + '\\System32\\OneDriveSetup.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($setup) { Start-Process -FilePath $setup -ArgumentList '/uninstall' -Wait } else { Write-Log 'OneDrive no está instalado' }" },
  removeMcafee: { label: 'Eliminar McAfee', command: "Write-Log 'Omitido: la eliminación segura requiere la herramienta oficial MCPR de McAfee'" },
  cortana: { label: 'Eliminar Cortana', command: "Remove-AppxSafe 'Microsoft.549981C3F5F10*'" },
  bingApps: { label: 'Eliminar Bing News y Weather', command: "Remove-AppxSafe 'Microsoft.Bing*'" },
  teamsConsumer: { label: 'Eliminar Teams personal', command: "Remove-AppxSafe '*MicrosoftTeams*'" },
  mixedReality: { label: 'Eliminar Mixed Reality Portal', command: "Remove-AppxSafe 'Microsoft.MixedReality.Portal*'" },
  viewer3d: { label: 'Eliminar Visor 3D', command: "Remove-AppxSafe 'Microsoft.Microsoft3DViewer*'" },
  solitaire: { label: 'Eliminar Solitaire Collection', command: "Remove-AppxSafe 'Microsoft.MicrosoftSolitaireCollection*'" },
  skypeOffice: { label: 'Eliminar Skype y Office Hub', command: "Remove-AppxSafe 'Microsoft.SkypeApp*'; Remove-AppxSafe 'Microsoft.MicrosoftOfficeHub*'" },
  clipchamp: { label: 'Eliminar Clipchamp', command: "Remove-AppxSafe 'Clipchamp.Clipchamp*'" },
  familySafety: { label: 'Eliminar Family Safety', command: "Remove-AppxSafe 'MicrosoftCorporationII.MicrosoftFamily*'" },
  feedbackHub: { label: 'Eliminar Centro de opiniones', command: "Remove-AppxSafe 'Microsoft.WindowsFeedbackHub*'" },
  mailCalendar: { label: 'Eliminar Correo y Calendario', command: "Remove-AppxSafe 'microsoft.windowscommunicationsapps*'" },
  maps: { label: 'Eliminar Mapas', command: "Remove-AppxSafe 'Microsoft.WindowsMaps*'" },
  moviesTV: { label: 'Eliminar Películas y TV', command: "Remove-AppxSafe 'Microsoft.ZuneVideo*'" },
  paint3d: { label: 'Eliminar Paint 3D', command: "Remove-AppxSafe 'Microsoft.MSPaint*'" },
  people: { label: 'Eliminar Contactos', command: "Remove-AppxSafe 'Microsoft.People*'" },
  powerAutomate: { label: 'Eliminar Power Automate', command: "Remove-AppxSafe 'Microsoft.PowerAutomateDesktop*'" },
  tips: { label: 'Eliminar Consejos', command: "Remove-AppxSafe 'Microsoft.Getstarted*'" },
  toDo: { label: 'Eliminar Microsoft To Do', command: "Remove-AppxSafe 'Microsoft.Todos*'" },
  weather: { label: 'Eliminar Weather', command: "Remove-AppxSafe 'Microsoft.BingWeather*'" },
  yourPhone: { label: 'Eliminar Phone Link', command: "Remove-AppxSafe 'Microsoft.YourPhone*'" },
  xboxApp: { label: 'Eliminar Xbox App', command: "Remove-AppxSafe 'Microsoft.GamingApp*'; Remove-AppxSafe 'Microsoft.XboxApp*'; Remove-AppxSafe 'Microsoft.XboxGamingOverlay*'" },
  devHome: { label: 'Eliminar Dev Home', command: "Remove-AppxSafe 'Microsoft.Windows.devhome*'" },
  getHelp: { label: 'Eliminar Obtener ayuda', command: "Remove-AppxSafe 'Microsoft.GetHelp*'" },
  quickAssist: { label: 'Eliminar Asistencia rápida', command: "Remove-AppxSafe 'MicrosoftCorporationII.QuickAssist*'" },
  crossDevice: { label: 'Eliminar Cross Device Experience Host', command: "Remove-AppxSafe 'MicrosoftWindows.CrossDevice*'" },
  stickyNotes: { label: 'Eliminar Notas rápidas', command: "Remove-AppxSafe 'Microsoft.MicrosoftStickyNotes*'" },
  soundRecorder: { label: 'Eliminar Grabadora de sonido', command: "Remove-AppxSafe 'Microsoft.WindowsSoundRecorder*'" },
  alarmsClock: { label: 'Eliminar Alarmas y reloj', command: "Remove-AppxSafe 'Microsoft.WindowsAlarms*'" },
  paintApp: { label: 'Eliminar Paint moderno', command: "Remove-AppxSafe 'Microsoft.Paint*'" },
  notepadApp: { label: 'Eliminar Bloc de notas', command: "Remove-AppxSafe 'Microsoft.WindowsNotepad*'" },
  snipSketch: { label: 'Eliminar Recortes', command: "Remove-AppxSafe 'Microsoft.ScreenSketch*'; Remove-AppxSafe 'Microsoft.SnippingTool*'" },
  calculatorApp: { label: 'Eliminar Calculadora', command: "Remove-AppxSafe 'Microsoft.WindowsCalculator*'" },
  photosApp: { label: 'Eliminar Fotos', command: "Remove-AppxSafe 'Microsoft.Windows.Photos*'" },
  bingSearch: { label: 'Eliminar componente Bing Search', command: "Remove-AppxSafe 'Microsoft.BingSearch*'" },
  zuneMusic: { label: 'Eliminar Groove Music', command: "Remove-AppxSafe 'Microsoft.ZuneMusic*'" },
  startExperiences: { label: 'Eliminar recomendaciones del menú Inicio', command: "Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' 'SystemPaneSuggestionsEnabled' 0; Set-RegDword 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' 'SubscribedContent-338388Enabled' 0" }
};

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function optimizationLogDirectory() {
  const directory = path.join(app.getPath('documents'), 'Super Optimizador', 'Logs');
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function buildOptimizationScript(keys, logPath) {
  const operations = keys.map(key => ({ key, operation: optimizationOperations[key] })).filter(item => item.operation);
  const steps = operations.map(({ key, operation }) => `Write-Log ${psQuote(`INICIO: ${operation.label} (${key})`)}
try {
  ${operation.command}
  Write-Log ${psQuote(`OK: ${operation.label}`)}
} catch {
  $failed = $true
  Write-Log (${psQuote(`ERROR: ${operation.label}`)} + ' - ' + $_.Exception.Message)
}`).join('\n');
  return `# Super Optimizador - cambios solicitados por el usuario
$ErrorActionPreference = 'Stop'
$failed = $false
$logPath = ${psQuote(logPath)}
function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $Message"
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}
function Set-RegDword([string]$Path,[string]$Name,[uint32]$Value) {
  New-Item -Path $Path -Force | Out-Null
  New-ItemProperty -Path $Path -Name $Name -PropertyType DWord -Value $Value -Force | Out-Null
}
function Set-RegString([string]$Path,[string]$Name,[string]$Value) {
  New-Item -Path $Path -Force | Out-Null
  New-ItemProperty -Path $Path -Name $Name -PropertyType String -Value $Value -Force | Out-Null
}
function Remove-RegValue([string]$Path,[string]$Name) {
  if (Test-Path $Path) { Remove-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue }
}
function Set-ServiceSafe([string]$Name,[string]$StartupType) {
  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($service) { Set-Service -Name $Name -StartupType $StartupType -ErrorAction Stop; if ($StartupType -eq 'Disabled' -and $service.Status -eq 'Running') { Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue } }
  else { Write-Log "Servicio no encontrado: $Name" }
}
function Remove-AppxSafe([string]$Pattern) {
  $packages = @(Get-AppxPackage -AllUsers -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $Pattern -or $_.PackageFullName -like $Pattern })
  if (!$packages.Count) { Write-Log "Paquete no encontrado: $Pattern"; return }
  foreach ($package in $packages) { Remove-AppxPackage -Package $package.PackageFullName -AllUsers -ErrorAction SilentlyContinue }
}
New-Item -ItemType File -Path $logPath -Force | Out-Null
Write-Log 'Inicio de aplicación elevada'
${steps}
Write-Log $(if ($failed) { 'Finalizado con errores' } else { 'Finalizado correctamente' })
exit ([int]$failed)
`;
}

async function runElevatedPowerShell(scriptPath) {
  const command = `$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',${psQuote(scriptPath)}); exit $process.ExitCode`;
  return execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 64 * 1024
  });
}

async function applyOptimizations(keys) {
  const selectedKeys = [...new Set(Array.isArray(keys) ? keys : [])].filter(key => Object.hasOwn(optimizationOperations, key));
  if (!selectedKeys.length) return { success: false, error: 'No hay ajustes válidos seleccionados.' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(optimizationLogDirectory(), `optimizacion-${stamp}.txt`);
  const scriptPath = path.join(app.getPath('temp'), `super-optimizador-${Date.now()}.ps1`);
  fs.writeFileSync(scriptPath, `\uFEFF${buildOptimizationScript(selectedKeys, logPath)}`, 'utf8');
  try {
    await runElevatedPowerShell(scriptPath);
    return { success: true, logPath, keys: selectedKeys };
  } catch (error) {
    return { success: false, logPath, error: /canceled|cancelado|denied|拒否/i.test(`${error.message} ${error.stderr}`) ? 'La confirmación UAC fue cancelada.' : 'PowerShell no pudo completar los ajustes. Revisa el registro TXT.' };
  } finally {
    try { fs.rmSync(scriptPath, { force: true }); } catch { /* no bloquear el resultado */ }
  }
}

async function applyDnsSettings(name, servers) {
  const allowedProfiles = {
    'Google DNS': ['8.8.8.8', '8.8.4.4'],
    Cloudflare: ['1.1.1.1', '1.0.0.1'],
    OpenDNS: ['208.67.222.222', '208.67.220.220']
  };
  const selectedServers = allowedProfiles[name];
  if (!selectedServers || JSON.stringify(selectedServers) !== JSON.stringify(servers)) return { success: false, error: 'Perfil DNS no válido.' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(optimizationLogDirectory(), `dns-${stamp}.txt`);
  const scriptPath = path.join(app.getPath('temp'), `super-optimizador-dns-${Date.now()}.ps1`);
  const serverList = selectedServers.map(psQuote).join(', ');
  const script = `$ErrorActionPreference = 'Stop'
$logPath = ${psQuote(logPath)}
function Write-Log([string]$Message) { Add-Content -LiteralPath $logPath -Value ("$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $Message") -Encoding UTF8 }
New-Item -ItemType File -Path $logPath -Force | Out-Null
Write-Log ${psQuote(`Inicio: ${name} (${selectedServers.join(', ')})`)}
try {
  $adapters = @(Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -and $_.InterfaceAlias -notmatch '(?i)virtual|vpn|loopback|bluetooth' })
  if (!$adapters.Count) { throw 'No se encontró una conexión Ethernet o Wi-Fi activa con puerta de enlace.' }
  $names = @()
  foreach ($adapter in $adapters) {
    Set-DnsClientServerAddress -InterfaceIndex ([int]$adapter.InterfaceIndex) -ServerAddresses @(${serverList})
    $names += $adapter.InterfaceAlias
    Write-Log "OK: DNS aplicado en $($adapter.InterfaceAlias) (índice $($adapter.InterfaceIndex))"
  }
  Write-Log ${psQuote(`Servidores: ${selectedServers.join(', ')}`)}
  Write-Log ("Adaptadores: " + ($names -join ', '))
  Write-Log 'Finalizado correctamente'
  exit 0
} catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
`;
  fs.writeFileSync(scriptPath, `\uFEFF${script}`, 'utf8');
  try {
    await runElevatedPowerShell(scriptPath);
    const log = fs.readFileSync(logPath, 'utf8');
    const adapterLine = log.split(/\r?\n/).find(line => line.includes('Adaptadores:')) || '';
    return { success: true, logPath, adapters: adapterLine.replace(/^.*Adaptadores:\s*/, '') };
  } catch (error) {
    return { success: false, logPath, error: /canceled|cancelado|denied/i.test(`${error.message} ${error.stderr}`) ? 'La confirmación UAC fue cancelada.' : 'No se pudo aplicar el DNS. Revisa el registro TXT.' };
  } finally {
    try { fs.rmSync(scriptPath, { force: true }); } catch { /* no bloquear el resultado */ }
  }
}

async function readDeviceInventory() {
  if (!systemInformation) return [];
  try {
    const [graphics, audio, networks, baseboard, cpu] = await Promise.all([
      systemInformation.graphics(),
      systemInformation.audio(),
      systemInformation.networkInterfaces(),
      systemInformation.baseboard(),
      systemInformation.cpu()
    ]);
    const devices = [];
    for (const controller of graphics.controllers || []) {
      devices.push({
        category: 'Gráficos',
        model: controller.model || 'GPU no identificada',
        vendor: controller.vendor || 'Fabricante desconocido',
        details: Number.isFinite(controller.vram) && controller.vram > 0 ? `VRAM: ${controller.vram} MB` : 'VRAM compartida o no disponible',
        downloadUrl: driverDownloadUrl('Gráficos', controller.vendor, controller.model)
      });
    }
    for (const controller of audio || []) {
      if (!controller.name) continue;
      devices.push({ category: 'Sonido', model: controller.name, vendor: controller.manufacturer || 'Fabricante desconocido', details: controller.status === 'enabled' ? 'Activo' : 'Estado no disponible', downloadUrl: driverDownloadUrl('Sonido', controller.manufacturer, controller.name) });
    }
    for (const network of (networks || []).filter(item => !item.internal && item.ifaceName)) {
      devices.push({ category: 'Red', model: network.ifaceName, vendor: network.virtual ? 'Adaptador virtual' : 'Adaptador físico', details: `${network.operstate === 'up' ? 'Conectado' : 'Desconectado'}${network.speed ? ` · ${network.speed} Mbps` : ''}`, downloadUrl: driverDownloadUrl('Red', network.ifaceName, network.iface) });
    }
    if (cpu?.brand) devices.push({ category: 'Procesador', model: cpu.brand, vendor: cpu.manufacturer || 'Fabricante desconocido', details: `${cpu.cores || '—'} núcleos`, downloadUrl: driverDownloadUrl('Procesador', cpu.manufacturer, cpu.brand) });
    if (baseboard?.model) devices.push({ category: 'Placa base', model: baseboard.model, vendor: baseboard.manufacturer || 'Fabricante desconocido', details: baseboard.version || 'Versión no disponible', downloadUrl: driverDownloadUrl('Placa base', baseboard.manufacturer, baseboard.model) });
    return devices;
  } catch {
    return [];
  }
}

function reduceMemoryExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'tools', 'ReduceMemory.exe')
    : path.join(__dirname, '..', 'tools', 'ReduceMemory.exe');
}

async function cleanMemory() {
  const executable = reduceMemoryExecutable();
  if (!fs.existsSync(executable)) return { success: false, error: 'ReduceMemory.exe no está incluido en el portable.' };
  try {
    const command = `$process = Start-Process -FilePath ${psQuote(executable)} -Verb RunAs -Wait -PassThru -ArgumentList @('/O'); exit $process.ExitCode`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 32 * 1024
    });
    return { success: true, tool: 'ReduceMemory', operations: ['working sets de aplicaciones y servicios'] };
  } catch (error) {
    return { success: false, error: /canceled|cancelado|denied/i.test(`${error.message} ${error.stderr}`) ? 'La confirmación UAC fue cancelada.' : 'ReduceMemory no pudo completar la limpieza. Revisa los permisos de administrador.' };
  }
}

async function readRunningGames() {
  const candidates = [
    { label: 'Minecraft Java', test: processInfo => /javaw?\.exe/i.test(processInfo.name) && /minecraft|lwjgl|fabricmc|net\.minecraft/i.test(`${processInfo.command} ${processInfo.params}`) },
    { label: 'PEAK', test: processInfo => /^(?:peak|peak-win64-shipping)\.exe$/i.test(processInfo.name) },
    { label: 'Counter-Strike 2', test: processInfo => /^(?:cs2|csgo)\.exe$/i.test(processInfo.name) },
    { label: 'Roblox', test: processInfo => /^robloxplayerbeta\.exe$/i.test(processInfo.name) },
    { label: 'Genshin Impact', test: processInfo => /^genshinimpact\.exe$/i.test(processInfo.name) },
    { label: 'Zenless Zone Zero', test: processInfo => /^zenlesszonezero\.exe$/i.test(processInfo.name) }
  ];
  if (!systemInformation) return [];
  try {
    const processes = await systemInformation.processes();
    return candidates.flatMap(candidate => {
      const match = processes.list.find(candidate.test);
      return match ? [{ name: candidate.label, process: match.name, pid: match.pid, memory: Number(match.memRss || 0) }] : [];
    });
  } catch {
    return [];
  }
}

async function runSystemScan() {
  const [health, startup, metrics, devices] = await Promise.all([readHealth(), readStartupEntries(), readMetrics(), readDeviceInventory()]);
  const findings = [];
  if (health.memoryUsedPercent >= 85) findings.push({ level: 'warn', title: 'La memoria está bastante ocupada', detail: `${health.memoryUsedPercent}% de RAM en uso` });
  else findings.push({ level: 'ok', title: 'Uso de memoria dentro de lo normal', detail: `${health.memoryUsedPercent}% de RAM en uso` });
  if (startup.length > 8) findings.push({ level: 'warn', title: 'Hay muchas aplicaciones en el inicio', detail: `${startup.length} registros Run detectados` });
  else findings.push({ level: 'ok', title: 'El inicio tiene una carga moderada', detail: `${startup.length} registros Run detectados` });
  if (health.storage && health.storage.usedPercent >= 90) findings.push({ level: 'warn', title: 'El almacenamiento está muy ocupado', detail: `${health.storage.usedPercent}% usado en ${health.storage.mount}` });
  else if (health.storage) findings.push({ level: 'ok', title: 'Hay espacio disponible en almacenamiento', detail: `${health.storage.freeGb} GB libres en ${health.storage.mount}` });
  if (metrics.cpu !== '—' && Number.parseInt(metrics.cpu, 10) >= 90) findings.push({ level: 'warn', title: 'La carga de CPU es elevada', detail: `${metrics.cpu} de uso en la lectura actual` });
  else findings.push({ level: 'ok', title: 'Carga de CPU dentro de la lectura esperada', detail: metrics.cpu === '—' ? 'No se pudo leer la carga de CPU' : `${metrics.cpu} de uso en la lectura actual` });
  const categoryCount = new Set(devices.map(device => device.category)).size;
  findings.push(categoryCount >= 4
    ? { level: 'ok', title: 'Hardware principal identificado', detail: `${devices.length} dispositivos en ${categoryCount} categorías` }
    : { level: 'info', title: 'Información de hardware parcial', detail: `${devices.length} dispositivos identificados` });
  return { findings, generatedAt: new Date().toISOString() };
}

function setOverlayEnabled(enabled) {
  overlayEnabled = Boolean(enabled);
  if (overlayEnabled) {
    createOverlayWindow();
    startFpsMonitor();
    if (!metricsTimer) metricsTimer = setInterval(sendMetrics, 2000);
    sendMetrics();
  } else {
    if (metricsTimer) clearInterval(metricsTimer);
    metricsTimer = null;
    stopFpsMonitor();
    closeOverlayWindow();
  }
  return overlayEnabled;
}

ipcMain.handle('overlay:set-enabled', (_event, enabled) => setOverlayEnabled(enabled));
ipcMain.handle('overlay:close', () => setOverlayEnabled(false));
ipcMain.handle('metrics:get', () => readMetrics());
ipcMain.handle('system:windows-info', () => readWindowsInfo());
ipcMain.handle('metrics:diagnostics', () => ({
  executable: presentMonExecutable(),
  executableExists: fs.existsSync(presentMonExecutable()),
  processRunning: Boolean(presentMonProcess),
  sessionActive: fpsSessionActive,
  error: presentMonError || null
}));
ipcMain.handle('system:log-directory', () => optimizationLogDirectory());
ipcMain.handle('network:measure-ping', () => measureDnsTargets());
ipcMain.handle('network:apply-dns', (_event, payload) => applyDnsSettings(payload?.name, payload?.servers));
ipcMain.handle('system:startup', () => readStartupEntries());
ipcMain.handle('system:health', () => readHealth());
ipcMain.handle('system:drivers', () => readDeviceInventory());
ipcMain.handle('memory:clean', () => cleanMemory());
ipcMain.handle('optimization:apply', (_event, keys) => applyOptimizations(keys));
ipcMain.handle('external:open', (_event, value) => {
  const url = String(value || '');
  if (!/^https:\/\//i.test(url)) throw new Error('URL no permitida');
  return shell.openExternal(url);
});
ipcMain.handle('system:games', () => readRunningGames());
ipcMain.handle('system:scan', () => runSystemScan());

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!singleInstance) return;
  createMainWindow();
  screen.on('display-metrics-changed', positionOverlay);
  screen.on('display-added', positionOverlay);
  screen.on('display-removed', positionOverlay);
});

app.on('window-all-closed', () => {
  stopFpsMonitor();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopFpsMonitor);
