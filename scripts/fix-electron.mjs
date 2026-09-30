/**
 * Restores a working Electron binary for local `npm run dev`.
 *
 * Never leave a packaged app.asar in electron/dist/resources — that makes
 * Electron ignore this project's package.json / main.js.
 *
 * win-unpacked copies have no default_app, so we install a tiny resources/app
 * launcher that loads process.cwd()'s package.json (this project).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const exePath = path.join(distDir, 'electron.exe');
const pathTxt = path.join(electronDir, 'path.txt');
const indexJs = path.join(electronDir, 'index.js');
const badAsar = path.join(distDir, 'resources', 'app.asar');
const defaultAppAsar = path.join(distDir, 'resources', 'default_app.asar');
const launcherDir = path.join(distDir, 'resources', 'app');
const launcherJs = path.join(launcherDir, 'launcher.js');
const unpacked = path.join(root, 'release', 'win-unpacked');
const unpackedExe = path.join(unpacked, 'MapLead Workspace.exe');
const packagedExe = path.join(distDir, 'MapLead Workspace.exe');

const LAUNCHER_PACKAGE = `{
  "name": "maplead-electron-launcher",
  "main": "launcher.js"
}
`;

const LAUNCHER_JS = `'use strict';

/**
 * Packaged-style Electron (from win-unpacked) has no default_app.
 * Load the project from process.cwd() so vite-plugin-electron / \`electron .\` works.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, dialog } = require('electron');

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');

function fail(message) {
  console.error(message);
  try {
    dialog.showErrorBox('MapLead Workspace', message);
  } catch (_) {}
  app.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
  fail('No package.json in cwd:\\n' + projectRoot);
} else {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (e) {
    fail('Invalid package.json:\\n' + e.message);
  }

  if (pkg.productName) app.name = pkg.productName;
  else if (pkg.name) app.name = pkg.name;
  if (pkg.version) app.setVersion(pkg.version);

  const mainRel = pkg.main || 'index.js';
  const mainFile = path.resolve(projectRoot, mainRel);
  if (!fs.existsSync(mainFile)) {
    fail('Main entry missing:\\n' + mainFile);
  } else {
    app.setAppPath(projectRoot);
    Object.defineProperty(process, 'defaultApp', {
      configurable: false,
      enumerable: true,
      value: true,
    });

    import(pathToFileURL(mainFile).href).catch((e) => {
      console.error(e);
      fail(String(e && e.stack ? e.stack : e));
    });
  }
}
`;

function hasOfficialDefaultApp() {
  return fs.existsSync(defaultAppAsar);
}

function hasLauncher() {
  return fs.existsSync(launcherJs) && !fs.existsSync(badAsar);
}

function ok() {
  return (
    fs.existsSync(indexJs) &&
    fs.existsSync(exePath) &&
    fs.existsSync(pathTxt) &&
    !fs.existsSync(badAsar) &&
    (hasOfficialDefaultApp() || hasLauncher())
  );
}

function installLauncher() {
  fs.mkdirSync(launcherDir, { recursive: true });
  fs.writeFileSync(path.join(launcherDir, 'package.json'), LAUNCHER_PACKAGE, 'utf8');
  fs.writeFileSync(launcherJs, LAUNCHER_JS, 'utf8');
  console.log('Installed resources/app launcher (loads project from cwd)');
}

function stripPackagedApp() {
  for (const p of [
    badAsar,
    path.join(distDir, 'resources', 'app.asar.unpacked'),
  ]) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log('Removed', p);
    } catch {
      /* ignore */
    }
  }
}

// Always sanitize path.txt — a trailing \r from PowerShell Set-Content breaks spawn
if (fs.existsSync(pathTxt)) {
  const cleaned = fs.readFileSync(pathTxt, 'utf8').replace(/\r?\n/g, '').trim() || 'electron.exe';
  fs.writeFileSync(pathTxt, cleaned, 'utf8');
}

if (ok()) {
  console.log('Electron OK:', exePath);
  process.exit(0);
}

if (!fs.existsSync(indexJs)) {
  console.log('Reinstalling electron package (ignore scripts)…');
  const r = spawnSync(
    'npm',
    ['install', 'electron@34.5.8', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!fs.existsSync(exePath)) {
  if (fs.existsSync(unpackedExe)) {
    console.log('Copying Electron binary from release/win-unpacked…');
    fs.mkdirSync(distDir, { recursive: true });
    fs.cpSync(unpacked, distDir, { recursive: true });
    fs.copyFileSync(unpackedExe, exePath);
  } else {
    console.log('Downloading Electron binary via install.js…');
    const r = spawnSync(process.execPath, [path.join(electronDir, 'install.js')], {
      cwd: electronDir,
      stdio: 'inherit',
      env: process.env,
    });
    if (r.status !== 0) {
      console.error('Failed to install Electron binary. Run: npm run build:dir');
      process.exit(r.status ?? 1);
    }
  }
}

stripPackagedApp();

// If we still have a packaged MapLead exe leftover name, keep electron.exe
if (fs.existsSync(packagedExe) && !fs.existsSync(exePath)) {
  fs.copyFileSync(packagedExe, exePath);
}

if (!hasOfficialDefaultApp()) {
  installLauncher();
}

// Electron's index.js joins path.txt as-is — trailing \r breaks spawn on Windows
fs.writeFileSync(pathTxt, 'electron.exe', 'utf8');
{
  const raw = fs.readFileSync(pathTxt, 'utf8').replace(/\r?\n/g, '').trim();
  if (raw !== 'electron.exe') {
    fs.writeFileSync(pathTxt, 'electron.exe', 'utf8');
  }
}

if (!ok()) {
  console.error('Electron still incomplete after fix.');
  console.error({
    exe: fs.existsSync(exePath),
    asarGone: !fs.existsSync(badAsar),
    defaultApp: hasOfficialDefaultApp(),
    launcher: hasLauncher(),
  });
  process.exit(1);
}

console.log('Electron fixed:', exePath);
