import { contextBridge, ipcRenderer } from 'electron';
import type { CoherentAPI, CoherentCommand, CoherentView } from './coherent-types';
const api: CoherentAPI = {
  invoke: (command: CoherentCommand) =>
    ipcRenderer.invoke('compost:command', command) as Promise<CoherentView>,
  subscribe: (callback) => {
    const handler = (_event: unknown, view: CoherentView) => callback(view);
    ipcRenderer.on('compost:state', handler);
    return () => {
      ipcRenderer.removeListener('compost:state', handler);
    };
  },
};
contextBridge.exposeInMainWorld('compost', api);
