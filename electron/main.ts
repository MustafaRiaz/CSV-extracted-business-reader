import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  Menu,
} from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');

// Boot diagnostic — proves which main.js Electron actually loads
try {
  fsSync.writeFileSync(
    path.join(process.cwd(), '_electron-boot.txt'),
    [
      new Date().toISOString(),
      `cwd=${process.cwd()}`,
      `__dirname=${__dirname}`,
      `url=${import.meta.url}`,
      `preloadCandidate=${path.join(__dirname, '../electron/preload-bridge.cjs')}`,
      `preloadExists=${fsSync.existsSync(path.join(__dirname, '../electron/preload-bridge.cjs'))}`,
    ].join('\n'),
    'utf8',
  );
} catch (err) {
  // last resort
  try {
    fsSync.writeFileSync('E:/My Projects/Development/Google maps extractor/lead-workspace/_electron-boot.txt', String(err));
  } catch { /* ignore */ }
}

let mainWindow: BrowserWindow | null = null;

/** Resolve a plain CJS preload that works with sandbox:true */
function resolvePreloadPath(): string {
  const candidates = [
    // Dev: main is in dist-electron/, source preload lives in ../electron/
    path.join(__dirname, '../electron/preload-bridge.cjs'),
    // Copied next to main for packaging
    path.join(__dirname, 'preload-bridge.cjs'),
    path.join(process.cwd(), 'electron/preload-bridge.cjs'),
    path.join(app.getAppPath(), 'electron/preload-bridge.cjs'),
  ];
  const debugLines = [
    `cwd=${process.cwd()}`,
    `__dirname=${__dirname}`,
    `import.meta.url=${import.meta.url}`,
  ];
  for (const candidate of candidates) {
    const exists = fsSync.existsSync(candidate);
    debugLines.push(`${exists ? 'FOUND' : 'miss '} ${candidate}`);
    if (exists) {
      try {
        fsSync.writeFileSync(
          path.join(process.cwd(), '_preload-debug.txt'),
          debugLines.concat([`USING ${candidate}`]).join('\n'),
          'utf8',
        );
      } catch {
        /* ignore */
      }
      return candidate;
    }
  }
  try {
    fsSync.writeFileSync(
      path.join(process.cwd(), '_preload-debug.txt'),
      debugLines.concat(['NONE FOUND']).join('\n'),
      'utf8',
    );
  } catch {
    /* ignore */
  }
  return candidates[0];
}

function createWindow() {
  const preloadPath = resolvePreloadPath();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'MapLead Workspace',
    backgroundColor: '#f4f7f6',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // Default sandbox:true — required for CJS require() in preload
      sandbox: true,
    },
    show: false,
  });

  mainWindow.webContents.on('preload-error', (_event, p, error) => {
    console.error('[preload-error]', p, error);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    void mainWindow?.webContents
      .executeJavaScript(
        '({ maplead: typeof window.maplead, ok: window.mapleadPreloadOk })',
      )
      .then((result) => {
        console.log('[electron] bridge check', result);
        try {
          fsSync.writeFileSync(
            path.join(app.getPath('userData'), 'bridge-check.json'),
            JSON.stringify(result, null, 2),
            'utf8',
          );
        } catch {
          /* ignore */
        }
        if (result?.maplead !== 'object') {
          console.error('[electron] Bridge still missing after load');
        }
      })
      .catch((err) => console.error('[electron] bridge check failed', err));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    if (process.platform === 'win32') {
      mainWindow?.setAlwaysOnTop(true);
      mainWindow?.setAlwaysOnTop(false);
    }
  });

  mainWindow.on('close', () => {
    mainWindow?.webContents.send('app:flush-save');
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function sidecarPath(csvPath: string) {
  return `${csvPath}.maplead.json`;
}

function progressDir() {
  return path.join(app.getPath('userData'), 'progress');
}

function progressPathFor(csvPath: string) {
  const resolved = path.resolve(csvPath);
  const hash = createHash('sha1')
    .update(resolved.toLowerCase())
    .digest('hex')
    .slice(0, 16);
  const base = path.basename(csvPath).replace(/[^\w.\-]+/g, '_');
  return path.join(progressDir(), `${hash}__${base}.json`);
}

async function ensureProgressDir() {
  await fs.mkdir(progressDir(), { recursive: true });
}

async function readJsonFile(file: string) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readSidecar(csvPath: string) {
  return readJsonFile(sidecarPath(csvPath));
}

async function readProgress(csvPath: string) {
  await ensureProgressDir();
  const exact = await readJsonFile(progressPathFor(csvPath));
  if (exact) return exact;

  try {
    const base = path.basename(csvPath).replace(/[^\w.\-]+/g, '_');
    const files = await fs.readdir(progressDir());
    const match = files.find((f) => f.includes(`__${base}.json`));
    if (match) return readJsonFile(path.join(progressDir(), match));
  } catch {
    /* ignore */
  }
  return null;
}

async function writeProgress(csvPath: string, data: unknown) {
  await ensureProgressDir();
  const payload = {
    filePath: path.resolve(csvPath),
    savedAt: new Date().toISOString(),
    ...(data as object),
  };
  await fs.writeFile(
    progressPathFor(csvPath),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
}

async function writeSidecar(csvPath: string, data: unknown) {
  await fs.writeFile(
    sidecarPath(csvPath),
    JSON.stringify(data, null, 2),
    'utf8',
  );
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open CSV…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        {
          label: 'Export CSV…',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function handle(channel: string, listener: Parameters<typeof ipcMain.handle>[1]) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, listener);
}

function registerIpc() {
  handle('dialog:openCsv', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open MapLead CSV',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = path.resolve(result.filePaths[0]);
    const content = await fs.readFile(filePath, 'utf8');
    const sidecar = (await readSidecar(filePath)) ?? (await readProgress(filePath));
    console.log('[openCsv]', filePath, 'progress=', Boolean(sidecar));
    return { filePath, content, sidecar };
  });

  handle('dialog:exportCsv', async (_event, content: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export CSV',
      defaultPath: defaultName ?? 'maplead-export.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });

  handle('file:readCsv', async (_event, filePath: string) => {
    const resolved = path.resolve(filePath);
    const content = await fs.readFile(resolved, 'utf8');
    const sidecar = (await readSidecar(resolved)) ?? (await readProgress(resolved));
    return { filePath: resolved, content, sidecar };
  });

  handle('progress:save', async (_event, csvPath: string, data: unknown) => {
    try {
      const resolved = path.resolve(csvPath);
      await writeProgress(resolved, data);
      try {
        await writeSidecar(resolved, data);
      } catch (err) {
        console.warn('[sidecar] optional write failed', err);
      }
      console.log('[progress:save] ok', progressPathFor(resolved));
      return { ok: true, progressPath: progressPathFor(resolved) };
    } catch (err) {
      console.error('[progress:save] failed', err);
      return { ok: false, error: String(err) };
    }
  });

  handle('file:saveCsv', async (_event, csvPath: string, content: string) => {
    try {
      const normalized = path.resolve(csvPath);
      if (!normalized.toLowerCase().endsWith('.csv')) {
        return { ok: false, error: 'Not a CSV path' };
      }
      await fs.writeFile(normalized, content, 'utf8');
      console.log('[saveCsv] ok', normalized, 'bytes', content.length);
      return { ok: true, path: normalized, bytes: content.length };
    } catch (err) {
      console.error('[saveCsv] failed', err);
      return { ok: false, error: String(err) };
    }
  });

  handle('shell:openExternal', async (_event, url: string) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('mailto:') &&
      !trimmed.startsWith('tel:') &&
      !trimmed.startsWith('whatsapp:')
    ) {
      return false;
    }
    await shell.openExternal(trimmed);
    return true;
  });

  handle('app:getRecent', async () => {
    const recentPath = path.join(app.getPath('userData'), 'recent.json');
    try {
      return JSON.parse(await fs.readFile(recentPath, 'utf8')) as string[];
    } catch {
      return [] as string[];
    }
  });

  handle('app:addRecent', async (_event, filePath: string) => {
    const recentPath = path.join(app.getPath('userData'), 'recent.json');
    let list: string[] = [];
    try {
      list = JSON.parse(await fs.readFile(recentPath, 'utf8')) as string[];
    } catch {
      list = [];
    }
    const resolved = path.resolve(filePath);
    list = [resolved, ...list.filter((p) => p !== resolved)].slice(0, 8);
    await fs.writeFile(recentPath, JSON.stringify(list, null, 2), 'utf8');
    return list;
  });

  ipcMain.removeAllListeners('file:saveCsvSync');
  ipcMain.on('file:saveCsvSync', (event, csvPath: string, content: string) => {
    try {
      const normalized = path.resolve(csvPath);
      fsSync.writeFileSync(normalized, content, 'utf8');
      event.returnValue = true;
    } catch (err) {
      console.error('[saveCsvSync]', err);
      event.returnValue = false;
    }
  });

  ipcMain.removeAllListeners('progress:saveSync');
  ipcMain.on('progress:saveSync', (event, csvPath: string, data: unknown) => {
    try {
      const resolved = path.resolve(csvPath);
      fsSync.mkdirSync(progressDir(), { recursive: true });
      fsSync.writeFileSync(
        progressPathFor(resolved),
        JSON.stringify(
          {
            filePath: resolved,
            savedAt: new Date().toISOString(),
            ...(data as object),
          },
          null,
          2,
        ),
        'utf8',
      );
      try {
        fsSync.writeFileSync(
          sidecarPath(resolved),
          JSON.stringify(data, null, 2),
          'utf8',
        );
      } catch {
        /* optional */
      }
      event.returnValue = true;
    } catch (err) {
      console.error('[progress:saveSync]', err);
      event.returnValue = false;
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
