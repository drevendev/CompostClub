import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  session,
  shell,
  Tray,
} from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { open, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DesktopStore } from './store';
import { DesktopController, type DesktopServices } from './controller';
import { isAuthorLink } from '../src/content/author';

const root = path.resolve(__dirname, '..');
app.setName('Compost Club');
const dataDirectory =
  app.commandLine.getSwitchValue('compost-data-dir') || process.env.COMPOST_DATA_DIR;
if (dataDirectory) app.setPath('userData', path.resolve(dataDirectory));
const loginArguments = () => [
  ...(app.isPackaged ? [] : [path.join(__dirname, 'main.cjs')]),
  '--compost-data-dir=' + app.getPath('userData'),
];
const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  let window: BrowserWindow | null = null,
    controller: DesktopController | undefined,
    tray: Tray | undefined,
    closing = false;
  const show = () => {
    if (!window || window.isDestroyed()) createWindow();
    window!.show();
    window!.focus();
  };
  const createWindow = () => {
    window = new BrowserWindow({
      width: 1320,
      height: 900,
      minWidth: 430,
      minHeight: 650,
      title: 'Compost Club',
      backgroundColor: '#f6f2e9',
      show: process.env.COMPOST_ACCEPTANCE !== '1',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
      },
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isAuthorLink(url)) {
        void shell.openExternal(url).catch((error: unknown) => {
          dialog.showErrorBox('Could not open author link', String(error));
        });
      }
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (
        url.split('#')[0] !== pathToFileURL(path.join(root, 'dist-desktop-ui', 'desktop.html')).href
      )
        event.preventDefault();
    });
    window.on('close', (event) => {
      if (!closing) {
        event.preventDefault();
        window?.hide();
      }
    });
    void window.loadFile(path.join(root, 'dist-desktop-ui', 'desktop.html'));
    window.webContents.on('did-finish-load', () => {
      if (controller) window?.webContents.send('compost:state', controller.view());
    });
  };
  app.on('second-instance', show);
  void app
    .whenReady()
    .then(() => {
      Menu.setApplicationMenu(null);
      session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
        callback(false),
      );
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        if (details.url.startsWith('file:')) {
          let safe = false;
          try {
            const target = path.resolve(fileURLToPath(details.url));
            safe = target
              .toLowerCase()
              .startsWith(path.join(root, 'dist-desktop-ui').toLowerCase() + path.sep);
          } catch {
            /* Invalid file URL is blocked. */
          }
          callback({ cancel: !safe });
        } else
          callback({
            cancel: !details.url.startsWith('data:') && !details.url.startsWith('devtools:'),
          });
      });
      const services: DesktopServices = {
        pick: async (kind) => {
          const options =
            kind === 'models' || kind === 'export'
              ? {
                  title:
                    kind === 'models'
                      ? 'Choose the installed Ollama model directory'
                      : 'Choose an empty Codex export folder',
                  properties: ['openDirectory', 'createDirectory'] as (
                    'openDirectory' | 'createDirectory'
                  )[],
                }
              : {
                  title:
                    kind === 'executable'
                      ? 'Choose your installed ollama.exe'
                      : kind === 'restore'
                        ? 'Choose a Compost Club backup'
                        : 'Choose UTF-8 idea files',
                  properties: [
                    'openFile',
                    ...(kind === 'import' ? ['multiSelections' as const] : []),
                  ] as ('openFile' | 'multiSelections')[],
                  filters: [
                    {
                      name: kind === 'executable' ? 'Ollama executable' : 'Idea files',
                      extensions:
                        kind === 'executable'
                          ? ['exe']
                          : kind === 'restore'
                            ? ['json']
                            : ['md', 'txt', 'json'],
                    },
                  ],
                };
          const result = window
            ? await dialog.showOpenDialog(window, options)
            : await dialog.showOpenDialog(options);
          return result.canceled ? [] : result.filePaths;
        },
        saveBackup: async (raw) => {
          const result = await dialog.showSaveDialog({
            title: 'Save private recovery backup',
            defaultPath: `compost-club-backup-${new Date().toISOString().slice(0, 10)}.json`,
            filters: [{ name: 'JSON backup', extensions: ['json'] }],
          });
          if (!result.canceled && result.filePath) {
            DesktopStore.parseBackup(raw);
            const stage = result.filePath + '.' + randomUUID() + '.pending';
            const file = await open(stage, 'wx');
            try {
              await file.writeFile(raw, 'utf8');
              await file.sync();
            } finally {
              await file.close();
            }
            await rename(stage, result.filePath);
            return true;
          }
          return false;
        },
        confirm: async (message) => {
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: 'Review before changing retained data',
            message,
            buttons: ['Cancel', 'Confirm'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          return result.response === 1;
        },
        openDirectory: async (directory) => {
          const error = await shell.openPath(directory);
          if (error) throw new Error(error);
        },
        autostart: (enabled) =>
          app.setLoginItemSettings({
            openAtLogin: enabled,
            path: process.execPath,
            args: loginArguments(),
          }),
        autostartEnabled: () =>
          app.getLoginItemSettings({
            path: process.execPath,
            args: loginArguments(),
          }).openAtLogin,
      };
      controller = new DesktopController(new DesktopStore(app.getPath('userData')), services, [
        root,
        app.getPath('userData'),
      ]);
      createWindow();
      const bitmap = Buffer.alloc(20 * 20 * 4);
      for (let y = 0; y < 20; y++)
        for (let x = 0; x < 20; x++)
          if (
            (x >= 9 && x <= 10 && y >= 8 && y <= 18) ||
            (x - 6) ** 2 + (y - 7) ** 2 < 17 ||
            (x - 14) ** 2 + (y - 5) ** 2 < 17
          ) {
            const at = (y * 20 + x) * 4;
            bitmap[at] = 70;
            bitmap[at + 1] = 115;
            bitmap[at + 2] = 80;
            bitmap[at + 3] = 255;
          }
      const icon = nativeImage.createFromBitmap(bitmap, { width: 20, height: 20, scaleFactor: 1 });
      tray = new Tray(icon);
      tray.setToolTip('Compost Club · paused');
      const update = () => {
        const state = controller!.view();
        tray?.setToolTip(`Compost Club · ${state.status}`);
        tray?.setContextMenu(
          Menu.buildFromTemplate([
            { label: 'Open Compost Club', click: show },
            {
              label: 'Add an idea',
              click: () => {
                show();
                void window?.webContents.executeJavaScript(
                  "window.dispatchEvent(new Event('compost:add-idea'))",
                );
              },
            },
            { type: 'separator' },
            {
              label: 'Pause and release model',
              enabled: state.status !== 'pausing',
              click: () => {
                void controller!
                  .command({ op: 'pause' })
                  .catch((e: unknown) => dialog.showErrorBox('Pause needs attention', String(e)));
              },
            },
            {
              label: 'Resume experiment',
              enabled: !state.busy && !state.workspace.experiment.enabled,
              click: () => {
                void controller!
                  .command({ op: 'resume' })
                  .catch((e: unknown) => dialog.showErrorBox('Cannot resume', String(e)));
              },
            },
            { type: 'separator' },
            { label: 'Exit', click: () => app.quit() },
          ]),
        );
        if (window && !window.isDestroyed()) window.webContents.send('compost:state', state);
      };
      controller.subscribe(update);
      update();
      tray.on('double-click', show);
      ipcMain.handle('compost:command', async (event, input: unknown) => {
        if (
          !window ||
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame
        )
          throw new Error('Untrusted IPC sender.');
        try {
          return await controller!.command(input);
        } catch (e) {
          return { ...controller!.view(), error: e instanceof Error ? e.message : String(e) };
        }
      });
      const timer = setInterval(() => controller!.tick(), 5000);
      timer.unref();
      powerMonitor.on('suspend', () => {
        void controller!.pause('Paused for sleep. Resume explicitly after wake.').catch(() => {});
      });
      powerMonitor.on('resume', () => {
        void controller!.pause('Paused after wake. Resume explicitly when ready.').catch(() => {});
      });
      app.on('activate', show);
    })
    .catch((e: unknown) => {
      dialog.showErrorBox(
        'Compost Club could not open',
        String(e) + '\nExisting data has not been replaced. See the local recovery guide.',
      );
      app.exit(1);
    });
  app.on('window-all-closed', () => {});
  app.on('before-quit', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    void controller
      ?.close()
      .then(() => {
        tray?.destroy();
        app.exit();
      })
      .catch((e: unknown) => {
        closing = false;
        show();
        dialog.showErrorBox('Shutdown needs attention', e instanceof Error ? e.message : String(e));
      });
    if (!controller) app.exit();
  });
}
