import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, DesktopCommand, DesktopView } from './types';
const api: DesktopAPI = {
  invoke: (command: DesktopCommand) =>
    ipcRenderer.invoke('compost:command', command) as Promise<DesktopView>,
  subscribe: (callback) => {
    const handler = (_event: unknown, view: DesktopView) => callback(view);
    ipcRenderer.on('compost:state', handler);
    return () => {
      ipcRenderer.removeListener('compost:state', handler);
    };
  },
};
contextBridge.exposeInMainWorld('compost', api);
