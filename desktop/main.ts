import { ClaudeRuntime } from './claude-runtime';
import { EncryptedCredentialStore } from './credentials';
import { GroqRuntime } from './groq-runtime';
import { OwnedOllama } from './runtime';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  session,
  safeStorage,
  shell,
  Tray,
} from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { open, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CoherentStore as DesktopStore } from './coherent-store';
import { CoherentController as DesktopController } from './coherent-controller';
import type { DesktopServices } from './controller';
import { isAuthorLink } from '../src/content/author';
import { safeUrl } from '../src/domain/coherent/prepare';
import { startOperator, type OperatorHandle } from './operator';

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
    operator: OperatorHandle | undefined,
    tray: Tray | undefined,
    closing = false,
    requestedShow = false;
  const show = () => {
    if (closing) return;
    if (!app.isReady() || !controller) {
      requestedShow = true;
      return;
    }
    if (!window || window.isDestroyed()) createWindow();
    if (window!.isMinimized()) window!.restore();
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
      icon: path.join(root, 'dist-desktop-ui', 'garden-icon.png'),
      backgroundColor: '#f6f2e9',
      show:
        process.env.COMPOST_ACCEPTANCE !== '1' &&
        !app.commandLine.hasSwitch('compost-start-hidden'),
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
      let reference = false;
      try {
        reference =
          safeUrl(url) === url &&
          !!controller?.store.state.references.some(
            (r) => !r.removed && r.url && safeUrl(r.url) === url,
          );
      } catch {
        /* Unsupported URL stays blocked. */
      }
      if (isAuthorLink(url) || reference) {
        void shell.openExternal(url).catch((error: unknown) => {
          dialog.showErrorBox(
            'Не удалось открыть ссылку автора',
            'Проверьте доступ к браузеру. Техническая причина: ' + String(error),
          );
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
    const contents = window.webContents;
    contents.on('did-finish-load', () => {
      if (!closing && controller && !contents.isDestroyed())
        contents.send('compost:state', controller.view());
    });
    window.on('closed', () => {
      window = null;
    });
  };
  app.on('second-instance', show);
  void app
    .whenReady()
    .then(async () => {
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
                      ? 'Выберите папку уже установленной модели Ollama'
                      : 'Выберите пустую папку для чтения в Codex',
                  properties: ['openDirectory', 'createDirectory'] as (
                    'openDirectory' | 'createDirectory'
                  )[],
                }
              : {
                  title:
                    kind === 'executable'
                      ? 'Выберите установленную программу ollama.exe'
                      : kind === 'restore'
                        ? 'Выберите полную резервную копию Compost Club'
                        : 'Выберите файлы исходных идей в UTF-8',
                  properties: [
                    'openFile',
                    ...(kind === 'import' ? ['multiSelections' as const] : []),
                  ] as ('openFile' | 'multiSelections')[],
                  filters: [
                    {
                      name: kind === 'executable' ? 'Программа Ollama' : 'Файлы идей',
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
            title: 'Сохранить полную приватную копию',
            defaultPath: `compost-club-backup-${new Date().toISOString().slice(0, 10)}.json`,
            filters: [{ name: 'Полная резервная копия JSON', extensions: ['json'] }],
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
            title: 'Проверьте изменения сохранённых данных',
            message,
            buttons: ['Отмена', 'Подтвердить'],
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
      const credentials = new EncryptedCredentialStore(app.getPath('userData'), safeStorage);
      await credentials.initialize();
      const claudeTokens = new EncryptedCredentialStore(
        app.getPath('userData'),
        safeStorage,
        'claude',
      );
      await claudeTokens.initialize();
      controller = new DesktopController(
        new DesktopStore(app.getPath('userData')),
        services,
        [root, app.getPath('userData')],
        new OwnedOllama(),
        new GroqRuntime(credentials),
        new ClaudeRuntime(
          app.getPath('userData'),
          () => controller?.store.state.claudeExecutable,
          undefined,
          undefined,
          claudeTokens,
          claudeTokens,
        ),
      );
      createWindow();
      if (requestedShow) show();
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
      tray.setToolTip('Compost Club · на паузе');
      const update = () => {
        if (closing) return;
        const state = controller!.view();
        tray?.setToolTip(
          `Compost Club · ${state.status === 'pausing' ? 'останавливаем' : state.busy ? 'создаём идею' : state.workspace.paused ? 'на паузе' : 'по расписанию'}`,
        );
        tray?.setContextMenu(
          Menu.buildFromTemplate([
            { label: 'Открыть Compost Club', click: show },
            {
              label: 'Добавить исходную идею',
              click: () => {
                show();
                void window?.webContents.executeJavaScript(
                  "window.dispatchEvent(new Event('compost:add-idea'))",
                );
              },
            },
            { type: 'separator' },
            {
              label:
                state.status === 'pausing'
                  ? 'Останавливаем…'
                  : state.busy || !state.workspace.paused
                    ? 'Пауза'
                    : 'Продолжить',
              enabled:
                state.status !== 'pausing' &&
                (state.busy ||
                  !state.workspace.paused ||
                  (state.status !== 'attention' &&
                    state.workspace.gardens.some((g) => g.background))),
              click: () => {
                void controller!
                  .command({ op: state.busy || !state.workspace.paused ? 'pause' : 'resume' })
                  .catch((e: unknown) =>
                    dialog.showErrorBox('Не удалось изменить состояние', String(e)),
                  );
              },
            },
            { type: 'separator' },
            { label: 'Выйти', click: () => app.quit() },
          ]),
        );
        if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
          window.webContents.send('compost:state', state);
      };
      controller.subscribe(update);
      update();
      operator = await startOperator(
        app.getPath('userData'),
        (command, confirmed) => {
          if (closing) return Promise.reject(new Error('Application is shutting down.'));
          return controller!.command(command, confirmed);
        },
        () => app.quit(),
        async () => {
          show();
          const current = window;
          if (!current || current.isDestroyed()) throw new Error('Window is unavailable.');
          return {
            pid: process.pid,
            visible: current.isVisible(),
            minimized: current.isMinimized(),
            focused: current.isFocused(),
            ready:
              !current.webContents.isLoadingMainFrame() &&
              (await current.webContents.executeJavaScript(
                'Boolean(document.querySelector(".desktop-app"))',
              )) === true,
          };
        },
      );
      tray.on('double-click', show);
      ipcMain.handle('compost:command', async (event, input: unknown) => {
        if (closing) throw new Error('Application is shutting down.');
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
      const timer = setInterval(() => {
        if (!closing) controller!.tick();
      }, 5000);
      timer.unref();
      powerMonitor.on('suspend', () => {
        if (closing) return;
        void controller!.pause('Paused for sleep. Resume explicitly after wake.').catch(() => {});
      });
      powerMonitor.on('resume', () => {
        if (closing) return;
        void controller!.pause('Paused after wake. Resume explicitly when ready.').catch(() => {});
      });
      app.on('activate', show);
    })
    .catch((e: unknown) => {
      dialog.showErrorBox(
        'Не удалось открыть Compost Club',
        'Сохранённые данные оставлены на месте. Проверьте приватную резервную копию и руководство по восстановлению. Техническая причина: ' +
          String(e),
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
      .then(async () => {
        await operator?.close();
        tray?.destroy();
        app.exit();
      })
      .catch((e: unknown) => {
        closing = false;
        show();
        dialog.showErrorBox(
          'Не удалось безопасно завершить работу',
          'Сохраните полную приватную копию и проверьте причину остановки. Технические подробности: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      });
    if (!controller) app.exit();
  });
}
