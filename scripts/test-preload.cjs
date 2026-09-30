const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const preload = path.join(__dirname, 'dist-electron', 'preload.cjs');
  console.log('preload exists', fs.existsSync(preload), preload);

  const w = new BrowserWindow({
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  w.webContents.on('preload-error', (_e, p, err) => {
    console.error('PRELOAD ERROR', p, err);
  });

  await w.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent('<!doctype html><title>t</title><body>ok</body>'),
  );

  const type = await w.webContents.executeJavaScript('typeof window.maplead');
  console.log('typeof window.maplead =', type);
  app.exit(type === 'object' ? 0 : 1);
});
